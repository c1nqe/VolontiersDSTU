//! Интеграционные тесты: настоящий PostgreSQL + настоящий HTTP-роутер.
//! Нужна переменная TEST_DATABASE_URL (пользователь с правом CREATE DATABASE, база `postgres`),
//! для каждого теста создаётся и затем удаляется отдельная база.
use std::net::SocketAddr;
use std::sync::Arc;

use axum::{body::Body, extract::ConnectInfo, http::{header, Request, StatusCode}, Router};
use base64::{engine::general_purpose::STANDARD, Engine};
use http_body_util::BodyExt;
use serde_json::{json, Value};
use sqlx::{postgres::PgPoolOptions, Connection, PgConnection, PgPool};
use tower::ServiceExt;
use volontiers_server::{app, auth::RateLimiter, config::Config, seed, MIGRATOR};

struct Env {
    app: Router,
    pool: PgPool,
    admin_url: String,
    db: String,
}

impl Env {
    async fn new() -> Env {
        let admin_url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL (…/postgres) не задана");
        let db = format!("vt_{}", uuid::Uuid::new_v4().simple());
        let mut c = PgConnection::connect(&admin_url).await.unwrap();
        sqlx::query(&format!("CREATE DATABASE {db}")).execute(&mut c).await.unwrap();
        let url = admin_url.rsplit_once('/').map(|(base, _)| format!("{base}/{db}")).unwrap();
        let pool = PgPoolOptions::new().max_connections(5).connect(&url).await.unwrap();
        MIGRATOR.run(&pool).await.unwrap();
        seed::run(&pool, false).await.unwrap();
        let cfg = Config::for_tests(url);
        let state = app::AppState { pool: pool.clone(), cfg: Arc::new(cfg), limiter: Arc::new(RateLimiter::new()) };
        Env { app: app::router(state), pool, admin_url, db }
    }

    async fn call(&self, cookie: Option<&str>, origin: Option<&str>, query: &str, vars: Value, extra: &[(&str, &str)]) -> (StatusCode, Value, Vec<String>) {
        let mut b = Request::builder().method("POST").uri("/graphql").header(header::CONTENT_TYPE, "application/json");
        if let Some(c) = cookie { b = b.header(header::COOKIE, c); }
        if let Some(o) = origin { b = b.header(header::ORIGIN, o); }
        for (k, v) in extra { b = b.header(*k, *v); }
        let mut req = b.body(Body::from(json!({"query": query, "variables": vars}).to_string())).unwrap();
        req.extensions_mut().insert(ConnectInfo("203.0.113.7:5555".parse::<SocketAddr>().unwrap()));
        let res = self.app.clone().oneshot(req).await.unwrap();
        let status = res.status();
        let cookies = res.headers().get_all(header::SET_COOKIE).iter().map(|v| v.to_str().unwrap().to_string()).collect();
        let bytes = res.into_body().collect().await.unwrap().to_bytes();
        (status, serde_json::from_slice(&bytes).unwrap_or(Value::Null), cookies)
    }

    /// Выполнить запрос; вернуть data, паникуя на ошибках.
    async fn ok(&self, cookie: Option<&str>, query: &str, vars: Value) -> Value {
        let (st, v, _) = self.call(cookie, None, query, vars, &[]).await;
        assert_eq!(st, StatusCode::OK);
        assert!(v.get("errors").is_none(), "неожиданная ошибка: {v}");
        v["data"].clone()
    }
    /// Выполнить запрос; вернуть (message, code) первой ошибки.
    async fn err(&self, cookie: Option<&str>, query: &str, vars: Value) -> (String, String) {
        let (_, v, _) = self.call(cookie, None, query, vars, &[]).await;
        let e = v["errors"].get(0).unwrap_or_else(|| panic!("ожидалась ошибка, получено: {v}"));
        (e["message"].as_str().unwrap().to_string(), e["extensions"]["code"].as_str().unwrap_or("").to_string())
    }

    async fn login(&self, email: &str, password: &str) -> String {
        let (_, v, cookies) = self.call(None, None, "mutation($e:String!,$p:String!){login(email:$e,password:$p){user{id role}}}", json!({"e": email, "p": password}), &[]).await;
        assert!(v.get("errors").is_none(), "{v}");
        cookies.iter().find(|c| c.starts_with("vt_session=")).unwrap().split(';').next().unwrap().to_string()
    }
    async fn admin(&self) -> String { self.login("admin@donstu.ru", "admin123").await }
    async fn organizer(&self) -> String { self.login("organizer@donstu.ru", "org123").await }
    async fn volunteer(&self) -> String { self.login("volunteer@donstu.ru", "vol123").await }

    async fn cleanup(self) {
        self.pool.close().await;
        let mut c = PgConnection::connect(&self.admin_url).await.unwrap();
        sqlx::query(&format!("DROP DATABASE IF EXISTS {} WITH (FORCE)", self.db)).execute(&mut c).await.unwrap();
    }
}

fn png_data_url(w: u32, h: u32) -> String {
    let img = image::RgbImage::from_fn(w, h, |x, y| image::Rgb([(x % 255) as u8, (y % 255) as u8, 90]));
    let mut buf = std::io::Cursor::new(Vec::new());
    img.write_to(&mut buf, image::ImageFormat::Png).unwrap();
    format!("data:image/png;base64,{}", STANDARD.encode(buf.into_inner()))
}

async fn org_and_vol_ids(env: &Env) -> (String, String) {
    let d = env.ok(Some(&env.admin().await), "{ organizations { id name } volonteers { id fullName } }", json!({})).await;
    let org = d["organizations"].as_array().unwrap().iter().find(|o| o["name"].as_str().unwrap().contains("Горящие")).unwrap()["id"].as_str().unwrap().to_string();
    let vol = d["volonteers"].as_array().unwrap().iter().find(|o| o["fullName"].as_str().unwrap().starts_with("Иванов")).unwrap()["id"].as_str().unwrap().to_string();
    (org, vol)
}

// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn guest_sees_only_public_data() {
    let env = Env::new().await;
    let d = env.ok(None, "{ events { status } organizations { name email phone contactPerson } requests { id } volonteers { id } me { id } }", json!({})).await;
    assert!(d["events"].as_array().unwrap().iter().all(|e| matches!(e["status"].as_str().unwrap(), "ACCEPTED" | "CLOSED")), "гость не должен видеть DRAFT");
    assert!(d["organizations"].as_array().unwrap().iter().all(|o| o["email"].is_null() && o["phone"].is_null() && o["contactPerson"].is_null()));
    assert_eq!(d["requests"].as_array().unwrap().len(), 0);
    assert_eq!(d["volonteers"].as_array().unwrap().len(), 0);
    assert!(d["me"].is_null());
    let (_, code) = env.err(None, "{ users { id } }", json!({})).await;
    assert_eq!(code, "UNAUTHENTICATED");
    env.cleanup().await;
}

#[tokio::test]
async fn login_cookie_flags_lockout_and_logout() {
    let env = Env::new().await;
    let (_, v, cookies) = env.call(None, None, "mutation{login(email:\"volunteer@donstu.ru\",password:\"vol123\"){token user{role}}}", json!({}), &[]).await;
    assert_eq!(v["data"]["login"]["user"]["role"], "VOLUNTEER");
    assert!(v["data"]["login"]["token"].is_null(), "токен не должен попадать в тело ответа браузеру");
    let c = &cookies[0];
    assert!(c.contains("HttpOnly") && c.contains("SameSite=Lax") && c.contains("Path=/"), "флаги cookie: {c}");

    // для не-браузерных клиентов токен выдаётся по явному заголовку
    let (_, v, _) = env.call(None, None, "mutation{login(email:\"volunteer@donstu.ru\",password:\"vol123\"){token}}", json!({}), &[("x-token-response", "1")]).await;
    let token = v["data"]["login"]["token"].as_str().unwrap().to_string();
    assert_eq!(token.split('.').count(), 3);
    let auth = format!("Bearer {token}");
    let (_, v, _) = env.call(None, None, "{ me { email } }", json!({}), &[("authorization", &auth)]).await;
    assert_eq!(v["data"]["me"]["email"], "volunteer@donstu.ru");

    // одинаковое сообщение для неизвестного email и неверного пароля (нет перечисления учёток)
    let (m1, _) = env.err(None, "mutation{login(email:\"nobody@x.ru\",password:\"whatever1\"){token}}", json!({})).await;
    let (m2, _) = env.err(None, "mutation{login(email:\"organizer@donstu.ru\",password:\"wrong-pass1\"){token}}", json!({})).await;
    assert_eq!(m1, m2);

    // блокировка после 5 неверных попыток; верный пароль в период блокировки тоже отклоняется
    for _ in 0..4 { env.err(None, "mutation{login(email:\"organizer@donstu.ru\",password:\"wrong-pass1\"){token}}", json!({})).await; }
    let (msg, code) = env.err(None, "mutation{login(email:\"organizer@donstu.ru\",password:\"org123\"){token}}", json!({})).await;
    assert_eq!(code, "TOO_MANY_REQUESTS", "{msg}");
    assert!(msg.contains("заблокирована"));

    // выход отзывает все выданные токены (token_version)
    env.call(None, None, "mutation{logout}", json!({}), &[("authorization", &auth)]).await;
    let (_, v, _) = env.call(None, None, "{ me { email } }", json!({}), &[("authorization", &auth)]).await;
    assert!(v["data"]["me"].is_null(), "после logout старый токен недействителен");
    env.cleanup().await;
}

#[tokio::test]
async fn register_rules() {
    let env = Env::new().await;
    let q = "mutation($e:String!,$p:String!,$r:UserRole!){register(firstName:\"Мария\",lastName:\"Тестова\",email:$e,password:$p,role:$r){user{id role organizationId volonteerId}}}";
    let (_, code) = env.err(None, q, json!({"e":"new@x.ru","p":"Str0ng-pass","r":"ADMIN"})).await;
    assert_eq!(code, "BAD_USER_INPUT", "ADMIN нельзя создать публичной регистрацией");
    let (m, _) = env.err(None, q, json!({"e":"new@x.ru","p":"short","r":"VOLUNTEER"})).await;
    assert!(m.contains("8 символов"));
    let (m, _) = env.err(None, q, json!({"e":"new@x.ru","p":"password","r":"VOLUNTEER"})).await;
    assert!(m.contains("простой"));
    let d = env.ok(None, q, json!({"e":"New@X.ru","p":"Str0ng-pass","r":"VOLUNTEER"})).await;
    assert!(d["register"]["user"]["volonteerId"].is_string());
    let (m, code) = env.err(None, q, json!({"e":"new@x.ru","p":"Str0ng-pass","r":"ORGANIZER"})).await;
    assert_eq!(code, "CONFLICT", "{m}");
    let d = env.ok(None, q, json!({"e":"org2@x.ru","p":"Str0ng-pass","r":"ORGANIZER"})).await;
    assert!(d["register"]["user"]["organizationId"].is_string());
    // пароль хранится только как argon2id-хэш
    let h: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE email = 'new@x.ru'").fetch_one(&env.pool).await.unwrap();
    assert!(h.starts_with("$argon2id$"));
    env.cleanup().await;
}

#[tokio::test]
async fn full_event_lifecycle_with_state_machine() {
    let env = Env::new().await;
    let (org, vol) = org_and_vol_ids(&env).await;
    let (a, o, v) = (env.admin().await, env.organizer().await, env.volunteer().await);

    // 1. организатор создаёт событие → DRAFT
    let d = env.ok(Some(&o), "mutation($org:ID!){createEvent(title:\"Субботник у реки\",description:\"Уборка берега\",location:\"Набережная\",startDate:\"2026-11-01\",endDate:\"2026-11-01\",requiredVolunteers:5,plannedHours:3.5,organizationId:$org){id status startDate startDateTime plannedHours}}", json!({"org": org})).await;
    let ev = d["createEvent"]["id"].as_str().unwrap().to_string();
    assert_eq!(d["createEvent"]["status"], "DRAFT");
    assert_eq!(d["createEvent"]["startDate"], "2026-11-01");
    assert_eq!(d["createEvent"]["startDateTime"], "2026-10-31T21:00:00Z", "00:00 МСК = 21:00 UTC");
    assert_eq!(d["createEvent"]["plannedHours"], 3.5);

    // 2. пока DRAFT, подать заявку нельзя; гость черновик не видит
    let sub = "mutation($v:ID!,$e:ID!){submitEventRequest(volonteerId:$v,eventId:$e){id status requestedHours}}";
    let (m, _) = env.err(Some(&v), sub, json!({"v": vol, "e": ev})).await;
    assert!(m.contains("ACCEPTED"), "{m}");
    let seen = env.ok(None, "query($id:ID!){event(id:$id){id}}", json!({"id": ev})).await;
    assert!(seen["event"].is_null());

    // 3. права на модерацию: только администратор
    let (_, code) = env.err(Some(&o), "mutation($e:ID!){moderateEvent(eventId:$e,status:ACCEPTED){id}}", json!({"e": ev})).await;
    assert_eq!(code, "FORBIDDEN");
    env.ok(Some(&a), "mutation($e:ID!){moderateEvent(eventId:$e,status:ACCEPTED){status}}", json!({"e": ev})).await;
    // ACCEPTED → CANCELLED запрещён автоматом состояний
    let (_, code) = env.err(Some(&a), "mutation($e:ID!){moderateEvent(eventId:$e,status:CANCELLED){id}}", json!({"e": ev})).await;
    assert_eq!(code, "CONFLICT");

    // 4. заявка OPEN; повторная — отклоняется
    let d = env.ok(Some(&v), sub, json!({"v": vol, "e": ev})).await;
    let req = d["submitEventRequest"]["id"].as_str().unwrap().to_string();
    assert_eq!(d["submitEventRequest"]["status"], "OPEN");
    assert_eq!(d["submitEventRequest"]["requestedHours"], 3.5);
    let (m, code) = env.err(Some(&v), sub, json!({"v": vol, "e": ev})).await;
    assert_eq!(code, "CONFLICT");
    assert!(m.contains("уже была подана"), "{m}");

    // 5. подтвердить часы нельзя, пока заявка не ACCEPTED
    let conf = "mutation($r:ID!,$h:Float!){confirmVolunteerWork(requestId:$r,confirmedHours:$h){status confirmedHours}}";
    let (_, code) = env.err(Some(&o), conf, json!({"r": req, "h": 3})).await;
    assert_eq!(code, "CONFLICT");
    // волонтёр не может принимать собственную заявку
    let (_, code) = env.err(Some(&v), "mutation($r:ID!){moderateRequest(requestId:$r,status:ACCEPTED){id}}", json!({"r": req})).await;
    assert_eq!(code, "FORBIDDEN");
    env.ok(Some(&o), "mutation($r:ID!){moderateRequest(requestId:$r,status:ACCEPTED){status}}", json!({"r": req})).await;
    // решение уже принято: повторное решение и отмена запрещены
    let (_, code) = env.err(Some(&o), "mutation($r:ID!){moderateRequest(requestId:$r,status:CANCELLED){id}}", json!({"r": req})).await;
    assert_eq!(code, "CONFLICT");
    let (_, code) = env.err(Some(&v), "mutation($r:ID!){cancelEventRequest(requestId:$r){id}}", json!({"r": req})).await;
    assert_eq!(code, "CONFLICT");

    // 6. подтверждение часов — один раз
    let (m, _) = env.err(Some(&o), conf, json!({"r": req, "h": -1})).await;
    assert!(m.contains("от 0 до 744"), "{m}");
    let d = env.ok(Some(&o), conf, json!({"r": req, "h": 3})).await;
    assert_eq!(d["confirmVolunteerWork"]["status"], "CONFIRMED");
    assert_eq!(d["confirmVolunteerWork"]["confirmedHours"], 3.0);
    let (_, code) = env.err(Some(&o), conf, json!({"r": req, "h": 5})).await;
    assert_eq!(code, "CONFLICT", "повторное подтверждение не должно менять часы");

    // 7. выписка учитывает только CLOSED + CONFIRMED
    let stmt = "query($v:ID!){volonteerStatement(volonteerId:$v,startDate:\"2026-11-01\",endDate:\"2026-11-30\"){totalHours closedEventsCount items{eventName confirmedHours}}}";
    let d = env.ok(Some(&v), stmt, json!({"v": vol})).await;
    assert_eq!(d["volonteerStatement"]["totalHours"], 0.0, "событие ещё не закрыто");
    env.ok(Some(&o), "mutation($e:ID!){closeEvent(eventId:$e){status}}", json!({"e": ev})).await;
    let d = env.ok(Some(&v), stmt, json!({"v": vol})).await;
    assert_eq!(d["volonteerStatement"]["totalHours"], 3.0);
    assert_eq!(d["volonteerStatement"]["items"][0]["eventName"], "Субботник у реки");
    let (_, code) = env.err(Some(&o), "mutation($e:ID!){closeEvent(eventId:$e){id}}", json!({"e": ev})).await;
    assert_eq!(code, "CONFLICT", "CLOSED → CLOSED недопустимо");

    // 8. отзыв: валидация и upsert
    let rev = "mutation($e:ID!,$v:ID!,$r:Int!,$t:String!){submitEventReview(eventId:$e,volonteerId:$v,rating:$r,text:$t){id rating text}}";
    let (m, _) = env.err(Some(&v), rev, json!({"e": ev, "v": vol, "r": 6, "t": "Очень хорошее мероприятие"})).await;
    assert!(m.contains("от 1 до 5"));
    let (m, _) = env.err(Some(&v), rev, json!({"e": ev, "v": vol, "r": 5, "t": "коротко"})).await;
    assert!(m.contains("10 символов"));
    let first = env.ok(Some(&v), rev, json!({"e": ev, "v": vol, "r": 5, "t": "Очень хорошее мероприятие"})).await;
    let second = env.ok(Some(&v), rev, json!({"e": ev, "v": vol, "r": 4, "t": "Всё понравилось, но жарко"})).await;
    assert_eq!(first["submitEventReview"]["id"], second["submitEventReview"]["id"], "один отзыв на участника");
    let d = env.ok(None, "query($e:ID!){eventReviews(eventId:$e){rating}}", json!({"e": ev})).await;
    assert_eq!(d["eventReviews"].as_array().unwrap().len(), 1);
    env.cleanup().await;
}

#[tokio::test]
async fn authorization_boundaries() {
    let env = Env::new().await;
    let (org, vol) = org_and_vol_ids(&env).await;
    let (o, v) = (env.organizer().await, env.volunteer().await);
    // организатор не может создавать события чужой организации
    let orgs = env.ok(None, "{ organizations { id name } }", json!({})).await;
    let other = orgs["organizations"].as_array().unwrap().iter().find(|x| x["id"] != org.as_str()).unwrap()["id"].as_str().unwrap().to_string();
    let mk = "mutation($org:ID!){createEvent(title:\"Чужое\",description:\"x\",location:\"y\",startDate:\"2026-12-01\",endDate:\"2026-12-01\",requiredVolunteers:1,plannedHours:1,organizationId:$org){id}}";
    let (_, code) = env.err(Some(&o), mk, json!({"org": other})).await;
    assert_eq!(code, "FORBIDDEN");
    let (_, code) = env.err(Some(&v), mk, json!({"org": org})).await;
    assert_eq!(code, "FORBIDDEN");
    let (_, code) = env.err(None, mk, json!({"org": org})).await;
    assert_eq!(code, "UNAUTHENTICATED");

    // волонтёр не подаёт заявку за другого волонтёра
    let all = env.ok(Some(&env.admin().await), "{ volonteers { id fullName } events(status:ACCEPTED){ id } }", json!({})).await;
    let other_vol = all["volonteers"].as_array().unwrap().iter().find(|x| x["id"] != vol.as_str()).unwrap()["id"].as_str().unwrap().to_string();
    let ev = all["events"][0]["id"].as_str().unwrap().to_string();
    let (_, code) = env.err(Some(&v), "mutation($v:ID!,$e:ID!){submitEventRequest(volonteerId:$v,eventId:$e){id}}", json!({"v": other_vol, "e": ev})).await;
    assert_eq!(code, "FORBIDDEN");

    // персональные данные: волонтёр видит только себя, чужие заявки и выписки закрыты
    let d = env.ok(Some(&v), "{ volonteers { id email birthDate } requests { volonteerId } }", json!({})).await;
    assert_eq!(d["volonteers"].as_array().unwrap().len(), 1);
    assert!(d["requests"].as_array().unwrap().iter().all(|r| r["volonteerId"] == vol.as_str()));
    let (_, code) = env.err(Some(&v), "query($v:ID!){volonteerStatement(volonteerId:$v,startDate:\"2026-01-01\",endDate:\"2026-12-31\"){totalHours}}", json!({"v": other_vol})).await;
    assert_eq!(code, "FORBIDDEN");
    // чужого волонтёра можно запросить по id, но контакты и дата рождения скрыты
    let d = env.ok(Some(&v), "query($id:ID!){volonteer(id:$id){fullName email phone birthDate}}", json!({"id": other_vol})).await;
    assert!(d["volonteer"]["email"].is_null() && d["volonteer"]["phone"].is_null() && d["volonteer"]["birthDate"].is_null());
    // организатор видит дату рождения никогда; контакты — только своих участников
    let d = env.ok(Some(&o), "{ volonteers { fullName email birthDate } }", json!({})).await;
    assert!(d["volonteers"].as_array().unwrap().iter().all(|x| x["birthDate"].is_null() && x["email"].is_string()));
    // список учётных записей — только администратор
    let (_, code) = env.err(Some(&o), "{ users { email } }", json!({})).await;
    assert_eq!(code, "FORBIDDEN");
    env.cleanup().await;
}

#[tokio::test]
async fn database_enforces_state_machine_and_audit() {
    let env = Env::new().await;
    let bad = |sql: &'static str| { let pool = env.pool.clone(); async move { sqlx::query(sql).execute(&pool).await } };
    // события: CLOSED → DRAFT / ACCEPTED → CANCELLED / DRAFT → CLOSED запрещены даже прямым SQL
    assert!(bad("UPDATE events SET status = 'DRAFT' WHERE status = 'CLOSED'").await.is_err());
    assert!(bad("UPDATE events SET status = 'CANCELLED' WHERE status = 'ACCEPTED'").await.is_err());
    assert!(bad("UPDATE events SET status = 'CLOSED' WHERE status = 'DRAFT'").await.is_err());
    // заявки: OPEN → CONFIRMED, ACCEPTED → CANCELLED запрещены; часы только при CONFIRMED
    assert!(bad("UPDATE volonteer_event_requests SET status = 'CONFIRMED', confirmed_hours = 1 WHERE status = 'OPEN'").await.is_err());
    assert!(bad("UPDATE volonteer_event_requests SET status = 'CANCELLED' WHERE status = 'ACCEPTED'").await.is_err());
    assert!(bad("UPDATE volonteer_event_requests SET confirmed_hours = 5 WHERE status = 'ACCEPTED'").await.is_err());
    // метки: FOUND → ACTIVE запрещён
    assert!(bad("UPDATE map_markers SET status = 'ACTIVE' WHERE status = 'FOUND'").await.is_err());
    // отзыв без участия запрещён триггером
    assert!(bad("INSERT INTO event_reviews (event_id, volonteer_id, author_name, rating, text)
                 SELECT e.id, v.id, 'x', 5, 'Отзыв без участия в событии' FROM events e, volonteers v
                  WHERE e.status = 'ACCEPTED' AND NOT EXISTS (SELECT 1 FROM volonteer_event_requests r WHERE r.event_id = e.id AND r.volonteer_id = v.id) LIMIT 1").await.is_err());
    // журнал аудита неизменяем
    assert!(bad("UPDATE audit_log SET action = 'x'").await.is_err());
    assert!(bad("DELETE FROM audit_log").await.is_err());
    assert!(bad("TRUNCATE audit_log").await.is_err());
    // действия попадают в журнал
    env.organizer().await;
    let n: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action = 'auth.login'").fetch_one(&env.pool).await.unwrap();
    assert!(n >= 1);
    env.cleanup().await;
}

#[tokio::test]
async fn photos_pipeline_and_access() {
    let env = Env::new().await;
    let v = env.volunteer().await;
    let mk = "mutation($i:MapMarkerInput!){createMapMarker(input:$i){id status photos createdByName}}";
    let base = |ty: &str, photos: Vec<String>| json!({"i": {"type": ty, "title": "Поиск: Тестов Т.Т.", "description": "Описание", "lat": 47.23, "lng": 39.71, "urgency": "HIGH", "photos": photos}});

    // гость не может создавать метки
    let (_, code) = env.err(None, mk, base("SEARCH_RESCUE", vec![])).await;
    assert_eq!(code, "UNAUTHENTICATED");
    // не изображение под видом PNG
    let fake = format!("data:image/png;base64,{}", STANDARD.encode("<html><script>alert(1)</script></html>".repeat(10)));
    let (m, code) = env.err(Some(&v), mk, base("SEARCH_RESCUE", vec![fake])).await;
    assert_eq!(code, "BAD_USER_INPUT", "{m}");
    // больше 5 фото
    let (m, _) = env.err(Some(&v), mk, base("SEARCH_RESCUE", (0..6).map(|_| png_data_url(40, 40)).collect())).await;
    assert!(m.contains("не более 5"), "{m}");
    // фото только у ПСО
    let (m, _) = env.err(Some(&v), mk, base("REGULAR", vec![png_data_url(40, 40)])).await;
    assert!(m.contains("только к меткам"), "{m}");

    // успешное создание: огромная картинка уменьшается и перекодируется в JPEG
    let d = env.ok(Some(&v), mk, base("SEARCH_RESCUE", vec![png_data_url(2400, 1200), png_data_url(100, 100)])).await;
    let marker = d["createMapMarker"]["id"].as_str().unwrap().to_string();
    let photos: Vec<String> = d["createMapMarker"]["photos"].as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect();
    assert_eq!(photos.len(), 2);
    assert_eq!(d["createMapMarker"]["createdByName"], "Иванов Алексей");

    let get = |uri: String, cookie: Option<String>| { let app = env.app.clone(); async move {
        let mut b = Request::builder().uri(uri);
        if let Some(c) = cookie { b = b.header(header::COOKIE, c); }
        let res = app.oneshot(b.body(Body::empty()).unwrap()).await.unwrap();
        let (st, headers) = (res.status(), res.headers().clone());
        (st, headers, res.into_body().collect().await.unwrap().to_bytes())
    } };
    let (st, h, body) = get(photos[0].clone(), None).await;
    assert_eq!(st, StatusCode::OK, "фото ПСО публичны (PUBLIC_MARKER_PHOTOS=true)");
    assert_eq!(h[header::CONTENT_TYPE], "image/jpeg");
    assert_eq!(h["x-content-type-options"], "nosniff");
    assert!(body.starts_with(&[0xFF, 0xD8, 0xFF]));
    let img = image::load_from_memory(&body).unwrap();
    assert!(img.width() <= 1600 && img.height() <= 1600, "размер ограничен");
    let (st, _, _) = get("/media/photos/00000000-0000-0000-0000-000000000000".into(), None).await;
    assert_eq!(st, StatusCode::NOT_FOUND);

    // отчёт о закрытии: нужно фото; фото отчёта — только для авторизованных
    let close = "mutation($m:ID!,$p:String){requestMarkerClose(markerId:$m,photo:$p,note:\"Найден живым\",targetStatus:FOUND){status closureProof{photo targetStatus}}}";
    let (m, _) = env.err(Some(&v), close, json!({"m": marker, "p": null})).await;
    assert!(m.contains("фотографию"), "{m}");
    let d = env.ok(Some(&v), close, json!({"m": marker, "p": png_data_url(300, 200)})).await;
    assert_eq!(d["requestMarkerClose"]["status"], "PENDING_APPROVAL");
    let proof = d["requestMarkerClose"]["closureProof"]["photo"].as_str().unwrap().to_string();
    let (st, _, _) = get(proof.clone(), None).await;
    assert_eq!(st, StatusCode::UNAUTHORIZED, "фото-отчёт гостю недоступно");
    let (st, h, _) = get(proof, Some(v.clone())).await;
    assert_eq!(st, StatusCode::OK);
    assert!(h[header::CACHE_CONTROL].to_str().unwrap().starts_with("private"));
    let guest = env.ok(None, "{ mapMarkers { id closureProof { photo } } }", json!({})).await;
    assert!(guest["mapMarkers"].as_array().unwrap().iter().all(|m| m["closureProof"].is_null()), "гость не видит отчёты о закрытии");

    // согласует только администратор
    let appr = "mutation($m:ID!){approveMarkerClose(markerId:$m){status closureProof{approvedBy}}}";
    let (_, code) = env.err(Some(&v), appr, json!({"m": marker})).await;
    assert_eq!(code, "FORBIDDEN");
    let admin = env.admin().await;
    let d = env.ok(Some(&admin), appr, json!({"m": marker})).await;
    assert_eq!(d["approveMarkerClose"]["status"], "FOUND");
    let (_, code) = env.err(Some(&admin), appr, json!({"m": marker})).await;
    assert_eq!(code, "CONFLICT");
    env.cleanup().await;
}

#[tokio::test]
async fn http_hardening() {
    let env = Env::new().await;
    // чужой Origin (CSRF) отклоняется
    let (st, _, _) = env.call(None, Some("https://evil.example"), "{ me { id } }", json!({}), &[]).await;
    assert_eq!(st, StatusCode::FORBIDDEN);
    let (st, _, _) = env.call(None, Some("http://localhost:5173"), "{ me { id } }", json!({}), &[]).await;
    assert_eq!(st, StatusCode::OK);
    // слишком глубокий запрос отклоняется
    let deep = "{ organizations { events { organization { events { organization { events { organization { events { organization { events { id } } } } } } } } } } }";
    let (_, v, _) = env.call(None, None, deep, json!({}), &[]).await;
    assert!(v["errors"][0]["message"].as_str().unwrap().to_lowercase().contains("nested"), "{v}");
    // заголовки безопасности и no-store
    let mut req = Request::builder().method("POST").uri("/graphql").header(header::CONTENT_TYPE, "application/json").body(Body::from("{\"query\":\"{me{id}}\"}")).unwrap();
    req.extensions_mut().insert(ConnectInfo("203.0.113.7:5555".parse::<SocketAddr>().unwrap()));
    let res = env.app.clone().oneshot(req).await.unwrap();
    assert_eq!(res.headers()["cache-control"], "no-store");
    assert_eq!(res.headers()["x-frame-options"], "DENY");
    assert!(res.headers()["content-security-policy"].to_str().unwrap().contains("default-src 'self'"));
    // мусорный UUID → понятная ошибка ввода, а не 500
    let (_, code) = env.err(None, "{ event(id:\"not-a-uuid\") { id } }", json!({})).await;
    assert_eq!(code, "BAD_USER_INPUT");
    env.cleanup().await;
}

#[tokio::test]
async fn seed_is_idempotent() {
    let env = Env::new().await;
    let before: i64 = sqlx::query_scalar("SELECT count(*) FROM events").fetch_one(&env.pool).await.unwrap();
    seed::run(&env.pool, false).await.unwrap();
    let after: i64 = sqlx::query_scalar("SELECT count(*) FROM events").fetch_one(&env.pool).await.unwrap();
    assert_eq!(before, after);
    seed::run(&env.pool, true).await.unwrap();
    let again: i64 = sqlx::query_scalar("SELECT count(*) FROM events").fetch_one(&env.pool).await.unwrap();
    assert_eq!(before, again);
    env.cleanup().await;
}
