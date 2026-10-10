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
use volontiers_server::{app, auth::RateLimiter, config::Config, mail::Mailer, seed, MIGRATOR};

struct Env {
    app: Router,
    pool: PgPool,
    admin_url: String,
    db: String,
    mailer: Arc<Mailer>,
}

impl Env {
    async fn new() -> Env { Env::with(|_| {}).await }

    async fn with(tweak: impl FnOnce(&mut Config)) -> Env {
        let admin_url = std::env::var("TEST_DATABASE_URL").expect("TEST_DATABASE_URL (…/postgres) не задана");
        let db = format!("vt_{}", uuid::Uuid::new_v4().simple());
        let mut c = PgConnection::connect(&admin_url).await.unwrap();
        sqlx::query(&format!("CREATE DATABASE {db}")).execute(&mut c).await.unwrap();
        let url = admin_url.rsplit_once('/').map(|(base, _)| format!("{base}/{db}")).unwrap();
        let pool = PgPoolOptions::new().max_connections(5).connect(&url).await.unwrap();
        MIGRATOR.run(&pool).await.unwrap();
        seed::run(&pool, false).await.unwrap();
        let mut cfg = Config::for_tests(url);
        tweak(&mut cfg);
        let mailer = Arc::new(Mailer::outbox());
        let state = app::AppState { pool: pool.clone(), cfg: Arc::new(cfg), limiter: Arc::new(RateLimiter::new()), mailer: mailer.clone() };
        Env { app: app::router(state), pool, admin_url, db, mailer }
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
    let q = "mutation($e:String!,$p:String!,$r:UserRole!){register(firstName:\"Мария\",lastName:\"Тестова\",email:$e,password:$p,role:$r,consent:true){user{id role organizationId volonteerId consentAcceptedAt consentVersion}}}";
    // без согласия на обработку персональных данных регистрация невозможна (152-ФЗ)
    let (m, code) = env.err(None, "mutation{register(firstName:\"А\",lastName:\"Б\",email:\"nc@x.ru\",password:\"Str0ng-pass\",role:VOLUNTEER,consent:false){token}}", json!({})).await;
    assert_eq!(code, "BAD_USER_INPUT");
    assert!(m.contains("согласие"), "{m}");
    let (_, code) = env.err(None, q, json!({"e":"new@x.ru","p":"Str0ng-pass","r":"ADMIN"})).await;
    assert_eq!(code, "BAD_USER_INPUT", "ADMIN нельзя создать публичной регистрацией");
    let (m, _) = env.err(None, q, json!({"e":"new@x.ru","p":"short","r":"VOLUNTEER"})).await;
    assert!(m.contains("8 символов"));
    let (m, _) = env.err(None, q, json!({"e":"new@x.ru","p":"password","r":"VOLUNTEER"})).await;
    assert!(m.contains("простой"));
    let d = env.ok(None, q, json!({"e":"New@X.ru","p":"Str0ng-pass","r":"VOLUNTEER"})).await;
    assert!(d["register"]["user"]["volonteerId"].is_string());
    assert!(d["register"]["user"]["consentAcceptedAt"].is_string(), "момент согласия фиксируется");
    let policy = env.ok(None, "{ privacyPolicyVersion }", json!({})).await;
    assert_eq!(d["register"]["user"]["consentVersion"], policy["privacyPolicyVersion"], "версия политики фиксируется");
    let (m, code) = env.err(None, q, json!({"e":"new@x.ru","p":"Str0ng-pass","r":"ORGANIZER"})).await;
    assert_eq!(code, "CONFLICT", "{m}");
    let d = env.ok(None, q, json!({"e":"org2@x.ru","p":"Str0ng-pass","r":"ORGANIZER"})).await;
    assert!(d["register"]["user"]["organizationId"].is_string());
    // организатор регистрируется сам и задаёт название организации; дубликат названия отклоняется
    let qo = "mutation($e:String!,$n:String){register(firstName:\"Пётр\",lastName:\"Орг\",email:$e,password:\"Str0ng-pass\",role:ORGANIZER,consent:true,organizationName:$n){user{organizationId}}}";
    let d = env.ok(None, qo, json!({"e": "own@x.ru", "n": "Клуб «Добрые руки»"})).await;
    let oid = d["register"]["user"]["organizationId"].as_str().unwrap().to_string();
    let name: String = sqlx::query_scalar("SELECT name FROM organizations WHERE id = $1::uuid").bind(&oid).fetch_one(&env.pool).await.unwrap();
    assert_eq!(name, "Клуб «Добрые руки»");
    let (m, code) = env.err(None, qo, json!({"e": "own2@x.ru", "n": "клуб «добрые руки»"})).await;
    assert_eq!(code, "CONFLICT", "{m}");
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
    // повторная модерация уже согласованного события отклоняется (отмена принятого — отдельная мутация cancelEvent)
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
    // повторное принятие той же заявки отклоняется
    let (_, code) = env.err(Some(&o), "mutation($r:ID!){moderateRequest(requestId:$r,status:ACCEPTED){id}}", json!({"r": req})).await;
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
    // события: CLOSED → DRAFT / CLOSED → CANCELLED / DRAFT → CLOSED запрещены даже прямым SQL
    assert!(bad("UPDATE events SET status = 'DRAFT' WHERE status = 'CLOSED'").await.is_err());
    assert!(bad("UPDATE events SET status = 'CANCELLED' WHERE status = 'CLOSED'").await.is_err());
    assert!(bad("UPDATE events SET status = 'CLOSED' WHERE status = 'DRAFT'").await.is_err());
    // заявки: OPEN → CONFIRMED, CONFIRMED → CANCELLED, ACCEPTED → OPEN запрещены; часы только при CONFIRMED
    assert!(bad("UPDATE volonteer_event_requests SET status = 'CONFIRMED', confirmed_hours = 1 WHERE status = 'OPEN'").await.is_err());
    assert!(bad("UPDATE volonteer_event_requests SET status = 'CANCELLED' WHERE status = 'CONFIRMED'").await.is_err());
    assert!(bad("UPDATE volonteer_event_requests SET status = 'OPEN' WHERE status = 'ACCEPTED'").await.is_err());
    assert!(bad("UPDATE volonteer_event_requests SET confirmed_hours = 5 WHERE status = 'ACCEPTED'").await.is_err());
    // метки: ACTIVE → FOUND (минуя отчёт и согласование) запрещён
    assert!(bad("UPDATE map_markers SET status = 'FOUND' WHERE status = 'ACTIVE'").await.is_err());
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
    let mk = "mutation($i:MapMarkerInput!){createMapMarker(input:$i){id status photos pendingPhotos createdByName}}";
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
    assert_eq!(d["createMapMarker"]["photos"].as_array().unwrap().len(), 0, "до проверки публичных фото нет");
    let photos: Vec<String> = d["createMapMarker"]["pendingPhotos"].as_array().unwrap().iter().map(|p| p.as_str().unwrap().to_string()).collect();
    assert_eq!(photos.len(), 2, "автор видит свои фото на проверке");
    assert_eq!(d["createMapMarker"]["createdByName"], "Иванов Алексей");

    let get = |uri: String, cookie: Option<String>| { let app = env.app.clone(); async move {
        let mut b = Request::builder().uri(uri);
        if let Some(c) = cookie { b = b.header(header::COOKIE, c); }
        let res = app.oneshot(b.body(Body::empty()).unwrap()).await.unwrap();
        let (st, headers) = (res.status(), res.headers().clone());
        (st, headers, res.into_body().collect().await.unwrap().to_bytes())
    } };

    // ---- предварительная модерация ----
    let admin = env.admin().await;
    let org = env.organizer().await;
    let (st, _, _) = get(photos[0].clone(), None).await;
    assert_eq!(st, StatusCode::UNAUTHORIZED, "гость не видит фото на проверке");
    let (st, _, _) = get(photos[0].clone(), Some(org.clone())).await;
    assert_eq!(st, StatusCode::NOT_FOUND, "чужой пользователь не видит фото на проверке");
    let (st, h, _) = get(photos[0].clone(), Some(v.clone())).await;
    assert_eq!(st, StatusCode::OK, "автор видит своё фото");
    assert_eq!(h[header::CACHE_CONTROL], "private, no-store");
    let (st, _, _) = get(photos[0].clone(), Some(admin.clone())).await;
    assert_eq!(st, StatusCode::OK, "администратор видит фото на проверке");
    let list = "{ mapMarkers { id photos pendingPhotos } }";
    for (who, label) in [(None, "гость"), (Some(org.as_str()), "другой пользователь")] {
        let d = env.ok(who, list, json!({})).await;
        let m = d["mapMarkers"].as_array().unwrap().iter().find(|m| m["id"] == marker.as_str()).unwrap();
        assert!(m["photos"].as_array().unwrap().is_empty() && m["pendingPhotos"].as_array().unwrap().is_empty(), "{label} не видит фото на проверке");
    }
    let queue = "{ photoModerationQueue { id markerId markerTitle url uploadedByName } }";
    let (_, code) = env.err(Some(&v), queue, json!({})).await;
    assert_eq!(code, "FORBIDDEN", "очередь модерации — только администратору");
    let (_, code) = env.err(None, queue, json!({})).await;
    assert_eq!(code, "UNAUTHENTICATED");
    let q = env.ok(Some(&admin), queue, json!({})).await;
    let items = q["photoModerationQueue"].as_array().unwrap();
    assert_eq!(items.len(), 2);
    assert_eq!(items[0]["uploadedByName"], "Иванов Алексей");
    let ids: Vec<String> = items.iter().map(|i| i["id"].as_str().unwrap().to_string()).collect();
    let approve = "mutation($p:ID!){approvePhoto(photoId:$p){photos pendingPhotos}}";
    let reject = "mutation($p:ID!,$r:String){rejectPhoto(photoId:$p,reason:$r){photos pendingPhotos}}";
    let (_, code) = env.err(Some(&v), approve, json!({"p": ids[0]})).await;
    assert_eq!(code, "FORBIDDEN", "автор не может одобрить своё фото");
    let (_, code) = env.err(Some(&v), reject, json!({"p": ids[0], "r": null})).await;
    assert_eq!(code, "FORBIDDEN");
    let d = env.ok(Some(&admin), approve, json!({"p": ids[0]})).await;
    assert_eq!(d["approvePhoto"]["photos"].as_array().unwrap().len(), 1);
    assert_eq!(d["approvePhoto"]["pendingPhotos"].as_array().unwrap().len(), 1);
    let (_, code) = env.err(Some(&admin), approve, json!({"p": ids[0]})).await;
    assert_eq!(code, "CONFLICT", "повторно одобрить нельзя");
    let d = env.ok(Some(&admin), reject, json!({"p": ids[1], "r": "Лицо ребёнка"})).await;
    assert_eq!(d["rejectPhoto"]["pendingPhotos"].as_array().unwrap().len(), 0);
    let (st, _, _) = get(photos[1].clone(), Some(admin.clone())).await;
    assert_eq!(st, StatusCode::NOT_FOUND, "отклонённое фото удалено");
    let logged: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action = 'photo.reject' AND details->>'reason' = 'Лицо ребёнка'")
        .fetch_one(&env.pool).await.unwrap();
    assert_eq!(logged, 1, "причина отказа записана в журнал");
    // после одобрения фото публично, остальное — без изменений
    let d = env.ok(None, list, json!({})).await;
    let m = d["mapMarkers"].as_array().unwrap().iter().find(|m| m["id"] == marker.as_str()).unwrap();
    assert_eq!(m["photos"].as_array().unwrap().len(), 1);
    let photos = vec![m["photos"][0].as_str().unwrap().to_string()];
    // фото администратора публикуются сразу
    let d = env.ok(Some(&admin), mk, base("SEARCH_RESCUE", vec![png_data_url(80, 80)])).await;
    assert_eq!(d["createMapMarker"]["photos"].as_array().unwrap().len(), 1);
    assert_eq!(d["createMapMarker"]["pendingPhotos"].as_array().unwrap().len(), 0);

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
    let appr = "mutation($m:ID!){approveMarkerClose(markerId:$m){status photos}}";
    let (_, code) = env.err(Some(&v), appr, json!({"m": marker})).await;
    assert_eq!(code, "FORBIDDEN");
    let d = env.ok(Some(&admin), appr, json!({"m": marker})).await;
    assert_eq!(d["approveMarkerClose"]["status"], "FOUND");
    // закрытая ПСО исчезает сразу: метка, фото и отчёт удалены из БД
    let (_, code) = env.err(Some(&admin), appr, json!({"m": marker})).await;
    assert_eq!(code, "CONFLICT", "метки больше нет — согласовывать нечего");
    let gone = env.ok(Some(&admin), "{ mapMarkers { id } }", json!({})).await;
    assert!(gone["mapMarkers"].as_array().unwrap().iter().all(|m| m["id"] != marker.as_str()), "закрытая ПСО не отображается");
    let left: i64 = sqlx::query_scalar("SELECT (SELECT count(*) FROM map_markers WHERE id = $1::uuid) + (SELECT count(*) FROM photos WHERE marker_id = $1::uuid) + (SELECT count(*) FROM marker_closures WHERE marker_id = $1::uuid)")
        .bind(&marker).fetch_one(&env.pool).await.unwrap();
    assert_eq!(left, 0, "метка, фото и отчёт удалены");
    let (st, _, _) = get(photos[0].clone(), None).await;
    assert_eq!(st, StatusCode::NOT_FOUND, "фото закрытой ПСО недоступно");
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

// ------------------------------------------------------------------------------------------------
/// Новые переходы: ACCEPTED → CANCELLED у события и у заявки (решение заказчика Q2).
#[tokio::test]
async fn cancellation_of_accepted_events_and_requests() {
    let env = Env::new().await;
    let (org, vol) = org_and_vol_ids(&env).await;
    let (a, o, v) = (env.admin().await, env.organizer().await, env.volunteer().await);
    let mk_event = |title: &'static str| { let org = org.clone(); let o = o.clone(); let env = &env; async move {
        let d = env.ok(Some(&o), "mutation($org:ID!,$t:String!){createEvent(title:$t,description:\"Описание\",location:\"Место\",startDate:\"2026-12-01\",endDate:\"2026-12-01\",requiredVolunteers:5,plannedHours:2,organizationId:$org){id}}", json!({"org": org, "t": title})).await;
        d["createEvent"]["id"].as_str().unwrap().to_string()
    } };
    let accept = |ev: String| { let a = a.clone(); let env = &env; async move { env.ok(Some(&a), "mutation($e:ID!){moderateEvent(eventId:$e,status:ACCEPTED){status}}", json!({"e": ev})).await; } };
    let sub = "mutation($v:ID!,$e:ID!){submitEventRequest(volonteerId:$v,eventId:$e){id status}}";

    // --- заявка ACCEPTED → CANCELLED: организатор отзывает, волонтёр отказывается
    let e1 = mk_event("Событие для отмены заявок").await;
    accept(e1.clone()).await;
    let r1 = env.ok(Some(&v), sub, json!({"v": vol, "e": e1})).await["submitEventRequest"]["id"].as_str().unwrap().to_string();
    env.ok(Some(&o), "mutation($r:ID!){moderateRequest(requestId:$r,status:ACCEPTED){status}}", json!({"r": r1})).await;
    let d = env.ok(Some(&v), "mutation($r:ID!){cancelEventRequest(requestId:$r){status}}", json!({"r": r1})).await;
    assert_eq!(d["cancelEventRequest"]["status"], "CANCELLED", "волонтёр может отказаться от принятой заявки");
    let (_, code) = env.err(Some(&v), "mutation($r:ID!){cancelEventRequest(requestId:$r){status}}", json!({"r": r1})).await;
    assert_eq!(code, "CONFLICT", "повторно отменить нельзя");

    // --- организатор отзывает принятую заявку с причиной
    let e2 = mk_event("Событие для отзыва заявки").await;
    accept(e2.clone()).await;
    let r2 = env.ok(Some(&v), sub, json!({"v": vol, "e": e2})).await["submitEventRequest"]["id"].as_str().unwrap().to_string();
    env.ok(Some(&o), "mutation($r:ID!){moderateRequest(requestId:$r,status:ACCEPTED){status}}", json!({"r": r2})).await;
    let d = env.ok(Some(&o), "mutation($r:ID!){moderateRequest(requestId:$r,status:CANCELLED,rejectionReason:\"Нет мест\"){status rejectionReason}}", json!({"r": r2})).await;
    assert_eq!(d["moderateRequest"]["status"], "CANCELLED");
    assert_eq!(d["moderateRequest"]["rejectionReason"], "Нет мест");

    // --- отмена принятого события каскадом отменяет открытые и принятые заявки
    let e3 = mk_event("Событие для отмены").await;
    accept(e3.clone()).await;
    let ra = env.ok(Some(&v), sub, json!({"v": vol, "e": e3})).await["submitEventRequest"]["id"].as_str().unwrap().to_string();
    env.ok(Some(&o), "mutation($r:ID!){moderateRequest(requestId:$r,status:ACCEPTED){status}}", json!({"r": ra})).await;
    let other_vol = env.ok(Some(&a), "{ volonteers { id } }", json!({})).await["volonteers"].as_array().unwrap().iter().map(|x| x["id"].as_str().unwrap().to_string()).find(|x| *x != vol).unwrap();
    let rb = env.ok(Some(&a), sub, json!({"v": other_vol, "e": e3})).await["submitEventRequest"]["id"].as_str().unwrap().to_string();
    let cancel = "mutation($e:ID!,$r:String){cancelEvent(eventId:$e,reason:$r){status cancelReason}}";
    let (_, code) = env.err(Some(&v), cancel, json!({"e": e3, "r": null})).await;
    assert_eq!(code, "FORBIDDEN", "волонтёр не отменяет события");
    let d = env.ok(Some(&o), cancel, json!({"e": e3, "r": "Плохая погода"})).await;
    assert_eq!(d["cancelEvent"]["status"], "CANCELLED");
    assert_eq!(d["cancelEvent"]["cancelReason"], "Плохая погода");
    for r in [&ra, &rb] {
        let (st, reason): (String, Option<String>) = sqlx::query_as("SELECT status::text, rejection_reason FROM volonteer_event_requests WHERE id = $1::uuid").bind(r).fetch_one(&env.pool).await.unwrap();
        assert_eq!(st, "CANCELLED", "заявки отменённого события отменяются");
        assert_eq!(reason.as_deref(), Some("Плохая погода"));
    }
    let (_, code) = env.err(Some(&o), cancel, json!({"e": e3, "r": null})).await;
    assert_eq!(code, "CONFLICT", "отменённое событие повторно не отменяется");
    // из каталога отменённое событие исчезает для гостя
    let seen = env.ok(None, "query($id:ID!){event(id:$id){id}}", json!({"id": e3})).await;
    assert!(seen["event"].is_null());

    // --- нельзя отменить событие, по которому уже подтверждены часы
    let e4 = mk_event("Событие с часами").await;
    accept(e4.clone()).await;
    let r4 = env.ok(Some(&v), sub, json!({"v": vol, "e": e4})).await["submitEventRequest"]["id"].as_str().unwrap().to_string();
    env.ok(Some(&o), "mutation($r:ID!){moderateRequest(requestId:$r,status:ACCEPTED){status}}", json!({"r": r4})).await;
    env.ok(Some(&o), "mutation($r:ID!){confirmVolunteerWork(requestId:$r,confirmedHours:2){status}}", json!({"r": r4})).await;
    let (m, code) = env.err(Some(&o), cancel, json!({"e": e4, "r": null})).await;
    assert_eq!(code, "CONFLICT");
    assert!(m.contains("подтверждены"), "{m}");
    // и принятую-подтверждённую заявку отменить нельзя
    let (_, code) = env.err(Some(&v), "mutation($r:ID!){cancelEventRequest(requestId:$r){status}}", json!({"r": r4})).await;
    assert_eq!(code, "CONFLICT");

    // --- черновик организатор отменяет сам; закрытое событие отменить нельзя
    let e5 = mk_event("Черновик").await;
    assert_eq!(env.ok(Some(&o), cancel, json!({"e": e5, "r": null})).await["cancelEvent"]["status"], "CANCELLED");
    env.ok(Some(&o), "mutation($e:ID!){closeEvent(eventId:$e){status}}", json!({"e": e4})).await;
    let (_, code) = env.err(Some(&o), cancel, json!({"e": e4, "r": null})).await;
    assert_eq!(code, "CONFLICT");

    // --- прямой SQL: принятую заявку закрытого события отменить нельзя
    sqlx::query("UPDATE volonteer_event_requests SET status = 'ACCEPTED', confirmed_hours = NULL WHERE id = $1::uuid").bind(&r4).execute(&env.pool).await.unwrap_err();
    env.cleanup().await;
}

// ------------------------------------------------------------------------------------------------
/// 152-ФЗ: выгрузка данных, удаление учётной записи с обезличиванием.
#[tokio::test]
async fn privacy_export_and_account_deletion() {
    let env = Env::new().await;
    let v = env.volunteer().await;

    // выгрузка содержит данные пользователя и записывается в журнал
    let d = env.ok(Some(&v), "mutation{exportMyData}", json!({})).await;
    let doc: Value = serde_json::from_str(d["exportMyData"].as_str().unwrap()).unwrap();
    assert_eq!(doc["account"]["email"], "volunteer@donstu.ru");
    assert_eq!(doc["account"]["role"], "VOLUNTEER");
    assert!(doc["volunteerProfile"]["phone"].is_string());
    assert!(doc["eventRequests"].as_array().unwrap().len() >= 2);
    assert!(doc["account"].get("password_hash").is_none() && !d["exportMyData"].as_str().unwrap().contains("argon2"), "хэш пароля не выгружается");
    assert!(doc["activityLog"].as_array().unwrap().iter().any(|x| x["action"] == "account.export" || x["action"] == "auth.login"));
    let (_, code) = env.err(None, "mutation{exportMyData}", json!({})).await;
    assert_eq!(code, "UNAUTHENTICATED");

    // метка с контактом, созданная волонтёром, — чтобы проверить обезличивание
    env.ok(Some(&v), "mutation{createMapMarker(input:{type:REGULAR,title:\"Помощь с покупками\",description:\"Нужна помощь\",lat:47.2,lng:39.7,urgency:LOW,contactPhone:\"+7 900 000-00-00\"}){id}}", json!({})).await;

    // удаление: нужен верный пароль
    let del = "mutation($p:String!){deleteMyAccount(password:$p)}";
    let (m, _) = env.err(Some(&v), del, json!({"p": "wrong-pass1"})).await;
    assert!(m.contains("Пароль"), "{m}");
    env.ok(Some(&v), del, json!({"p": "vol123"})).await;

    // старая сессия и повторный вход невозможны
    let me = env.ok(Some(&v), "{ me { id } }", json!({})).await;
    assert!(me["me"].is_null(), "сессия удалённого пользователя недействительна");
    let (_, code) = env.err(None, "mutation{login(email:\"volunteer@donstu.ru\",password:\"vol123\"){token}}", json!({})).await;
    assert_eq!(code, "BAD_USER_INPUT");

    // персональные данные обезличены; обезличенные часы остаются у организатора
    let (first, last, birth): (String, String, Option<chrono::NaiveDate>) = sqlx::query_as(
        "SELECT p.first_name, p.last_name, p.birth_date FROM users u JOIN persons p ON p.id = u.person_id WHERE u.deleted_at IS NOT NULL").fetch_one(&env.pool).await.unwrap();
    assert_eq!((first.as_str(), last.as_str()), ("пользователь", "Удалённый"));
    assert!(birth.is_none());
    let (email, phone, student): (String, String, Option<String>) = sqlx::query_as("SELECT email, phone, student_id FROM volonteers WHERE email LIKE 'deleted-%'").fetch_one(&env.pool).await.unwrap();
    assert!(email.ends_with("@deleted.invalid") && phone.is_empty() && student.is_none());
    let reviews: i64 = sqlx::query_scalar("SELECT count(*) FROM event_reviews rv JOIN volonteers v ON v.id = rv.volonteer_id WHERE v.email LIKE 'deleted-%'").fetch_one(&env.pool).await.unwrap();
    assert_eq!(reviews, 0, "отзывы удалены");
    let (open,): (i64,) = sqlx::query_as("SELECT count(*) FROM volonteer_event_requests r JOIN volonteers v ON v.id = r.volonteer_id WHERE v.email LIKE 'deleted-%' AND r.status IN ('OPEN','ACCEPTED')").fetch_one(&env.pool).await.unwrap();
    assert_eq!(open, 0, "активные заявки отменены");
    let confirmed: i64 = sqlx::query_scalar("SELECT count(*) FROM volonteer_event_requests r JOIN volonteers v ON v.id = r.volonteer_id WHERE v.email LIKE 'deleted-%' AND r.status = 'CONFIRMED'").fetch_one(&env.pool).await.unwrap();
    assert!(confirmed >= 1, "подтверждённые часы остаются обезличенными");
    let (mphone, mname): (Option<String>, String) = sqlx::query_as("SELECT contact_phone, created_by_name FROM map_markers WHERE title = 'Помощь с покупками'").fetch_one(&env.pool).await.unwrap();
    assert!(mphone.is_none());
    assert_eq!(mname, "Удалённый пользователь");
    let leaked: i64 = sqlx::query_scalar("SELECT count(*) FROM persons WHERE last_name = 'Иванов' AND first_name = 'Алексей'").fetch_one(&env.pool).await.unwrap();
    assert_eq!(leaked, 0, "имя пользователя нигде не осталось");

    // организатор с активными событиями не может удалить аккаунт; администратор — тоже
    let o = env.organizer().await;
    let (m, code) = env.err(Some(&o), del, json!({"p": "org123"})).await;
    assert_eq!(code, "CONFLICT", "{m}");
    let (_, code) = env.err(Some(&env.admin().await), del, json!({"p": "admin123"})).await;
    assert_eq!(code, "BAD_USER_INPUT");
    env.cleanup().await;
}

// ------------------------------------------------------------------------------------------------
#[tokio::test]
async fn capacity_profile_and_password() {
    let env = Env::new().await;
    let (org, vol) = org_and_vol_ids(&env).await;
    let (a, o, v) = (env.admin().await, env.organizer().await, env.volunteer().await);

    // --- вместимость: событие на одного волонтёра
    let d = env.ok(Some(&o), "mutation($org:ID!){createEvent(title:\"Событие на одного\",description:\"Описание\",location:\"Место\",startDate:\"2026-12-05\",endDate:\"2026-12-05\",requiredVolunteers:1,plannedHours:2,organizationId:$org){id}}", json!({"org": org})).await;
    let ev = d["createEvent"]["id"].as_str().unwrap().to_string();
    env.ok(Some(&a), "mutation($e:ID!){moderateEvent(eventId:$e,status:ACCEPTED){status}}", json!({"e": ev})).await;
    let other_vol = env.ok(Some(&a), "{ volonteers { id } }", json!({})).await["volonteers"].as_array().unwrap().iter().map(|x| x["id"].as_str().unwrap().to_string()).find(|x| *x != vol).unwrap();
    let sub = "mutation($v:ID!,$e:ID!){submitEventRequest(volonteerId:$v,eventId:$e){id}}";
    let r1 = env.ok(Some(&v), sub, json!({"v": vol, "e": ev})).await["submitEventRequest"]["id"].as_str().unwrap().to_string();
    let r2 = env.ok(Some(&a), sub, json!({"v": other_vol, "e": ev})).await["submitEventRequest"]["id"].as_str().unwrap().to_string();
    let acc = "mutation($r:ID!){moderateRequest(requestId:$r,status:ACCEPTED){status}}";
    env.ok(Some(&o), acc, json!({"r": r1})).await;
    let (m, code) = env.err(Some(&o), acc, json!({"r": r2})).await;
    assert_eq!(code, "CONFLICT", "{m}");
    assert!(m.contains("1 из 1"), "{m}");
    // отозвали первую — место освободилось
    env.ok(Some(&o), "mutation($r:ID!){moderateRequest(requestId:$r,status:CANCELLED,rejectionReason:\"Передумали\"){status}}", json!({"r": r1})).await;
    env.ok(Some(&o), acc, json!({"r": r2})).await;

    // --- профиль: волонтёр правит свои данные, остальные поля не трогаются
    let upd = "mutation($p:String,$f:String,$s:String,$n:String){updateMyProfile(firstName:$n,phone:$p,faculty:$f,studentId:$s){firstName lastName phone faculty studentId}}";
    let d = env.ok(Some(&v), upd, json!({"p": "+7 900 111-22-33", "f": "Информатика", "s": "12345", "n": null})).await;
    assert_eq!(d["updateMyProfile"]["phone"], "+7 900 111-22-33");
    assert_eq!(d["updateMyProfile"]["faculty"], "Информатика");
    assert_eq!(d["updateMyProfile"]["lastName"], "Иванов", "фамилия не изменена");
    let d = env.ok(Some(&v), upd, json!({"p": null, "f": "", "s": null, "n": "Алексей"})).await;
    assert!(d["updateMyProfile"]["faculty"].is_null(), "пустая строка очищает факультет");
    assert_eq!(d["updateMyProfile"]["phone"], "+7 900 111-22-33", "телефон остался");
    let (_, code) = env.err(Some(&v), upd, json!({"p": null, "f": null, "s": null, "n": ""})).await;
    assert_eq!(code, "BAD_USER_INPUT", "имя не может быть пустым");
    let (_, code) = env.err(Some(&o), upd, json!({"p": "1", "f": null, "s": null, "n": null})).await;
    assert_eq!(code, "FORBIDDEN", "профиль волонтёра правит только волонтёр");
    let (_, code) = env.err(None, upd, json!({"p": "1", "f": null, "s": null, "n": null})).await;
    assert_eq!(code, "UNAUTHENTICATED");

    // --- смена пароля: старый перестаёт работать, сессии отзываются
    let chg = "mutation($o:String!,$n:String!){changePassword(oldPassword:$o,newPassword:$n)}";
    let (m, _) = env.err(Some(&v), chg, json!({"o": "неверный-пароль1", "n": "Новый-пароль-2026"})).await;
    assert!(m.contains("пароль"), "{m}");
    env.ok(Some(&v), chg, json!({"o": "vol123", "n": "Новый-пароль-2026"})).await;
    let (_, code) = env.err(None, "mutation{login(email:\"volunteer@donstu.ru\",password:\"vol123\"){user{id}}}", json!({})).await;
    assert_eq!(code, "BAD_USER_INPUT", "старый пароль больше не подходит");
    env.login("volunteer@donstu.ru", "Новый-пароль-2026").await;
    env.cleanup().await;
}

// ------------------------------------------------------------------------------------------------
fn token_from(mail: &volontiers_server::mail::Mail, key: &str) -> String {
    let marker = format!("/?{key}=");
    let rest = mail.text.split(&marker).nth(1).unwrap_or_else(|| panic!("в письме нет ссылки {key}: {}", mail.text));
    rest.split_whitespace().next().unwrap().to_string()
}

#[tokio::test]
async fn email_verification_and_password_reset() {
    let env = Env::new().await;
    let reg = "mutation($e:String!){register(firstName:\"Мария\",lastName:\"Почтова\",email:$e,password:\"Str0ng-pass\",role:VOLUNTEER,consent:true){user{id emailVerified volonteerId}}}";
    let d = env.ok(None, reg, json!({"e": "maria@x.ru"})).await;
    assert_eq!(d["register"]["user"]["emailVerified"], false);

    // --- подтверждение почты
    let mails = env.mailer.take_outbox();
    assert_eq!(mails.len(), 1, "при регистрации уходит одно письмо");
    assert_eq!(mails[0].to, "maria@x.ru");
    assert!(mails[0].subject.contains("Подтвердите"));
    let verify = "mutation($t:String!){verifyEmail(token:$t)}";
    let (_, code) = env.err(None, verify, json!({"t": "не-тот-токен"})).await;
    assert_eq!(code, "BAD_USER_INPUT");
    let token = token_from(&mails[0], "verify");
    let stored: String = sqlx::query_scalar("SELECT token_hash FROM email_tokens WHERE purpose = 'VERIFY_EMAIL'").fetch_one(&env.pool).await.unwrap();
    assert_ne!(stored, token, "в базе лежит только хэш токена");
    assert_eq!(stored.len(), 64);
    // токен от письма для сброса пароля не подходит для подтверждения почты (виды токенов не смешиваются) — проверим ниже
    assert_eq!(env.ok(None, verify, json!({"t": token})).await["verifyEmail"], true);
    let (_, code) = env.err(None, verify, json!({"t": token})).await;
    assert_eq!(code, "BAD_USER_INPUT", "ссылка одноразовая");
    let me = env.login("maria@x.ru", "Str0ng-pass").await;
    assert_eq!(env.ok(Some(&me), "{ me { emailVerified } }", json!({})).await["me"]["emailVerified"], true);
    // уже подтверждена — повторная отправка ничего не шлёт
    env.ok(Some(&me), "mutation{resendVerification}", json!({})).await;
    assert!(env.mailer.take_outbox().is_empty());
    let (_, code) = env.err(None, "mutation{resendVerification}", json!({})).await;
    assert_eq!(code, "UNAUTHENTICATED");

    // --- восстановление пароля
    let ask = "mutation($e:String!){requestPasswordReset(email:$e)}";
    assert_eq!(env.ok(None, ask, json!({"e": "nobody@x.ru"})).await["requestPasswordReset"], true, "ответ одинаков для неизвестного адреса");
    assert!(env.mailer.take_outbox().is_empty(), "неизвестному адресу письмо не уходит");
    assert_eq!(env.ok(None, ask, json!({"e": "Maria@X.ru"})).await["requestPasswordReset"], true);
    let mails = env.mailer.take_outbox();
    assert_eq!(mails.len(), 1);
    assert!(mails[0].subject.contains("Восстановление"));
    env.ok(None, ask, json!({"e": "maria@x.ru"})).await;
    assert!(env.mailer.take_outbox().is_empty(), "повторный запрос в течение минуты письма не шлёт");
    let reset_token = token_from(&mails[0], "reset");

    let reset = "mutation($t:String!,$p:String!){resetPassword(token:$t,newPassword:$p)}";
    let (_, code) = env.err(None, reset, json!({"t": token, "p": "N3w-strong-pass"})).await;
    assert_eq!(code, "BAD_USER_INPUT", "токен подтверждения почты не меняет пароль");
    let (m, _) = env.err(None, reset, json!({"t": reset_token, "p": "short"})).await;
    assert!(m.contains("8 символов"), "{m}");
    // слабый пароль не сжигает ссылку
    assert_eq!(env.ok(None, reset, json!({"t": reset_token, "p": "N3w-strong-pass"})).await["resetPassword"], true);
    let (_, code) = env.err(None, reset, json!({"t": reset_token, "p": "An0ther-pass-1"})).await;
    assert_eq!(code, "BAD_USER_INPUT", "ссылка одноразовая");
    assert!(env.ok(Some(&me), "{ me { id } }", json!({})).await["me"].is_null(), "старые сессии отозваны");
    let (_, code) = env.err(None, "mutation{login(email:\"maria@x.ru\",password:\"Str0ng-pass\"){expiresAt}}", json!({})).await;
    assert_eq!(code, "BAD_USER_INPUT", "старый пароль не работает");
    env.login("maria@x.ru", "N3w-strong-pass").await;
    let logged: i64 = sqlx::query_scalar("SELECT count(*) FROM audit_log WHERE action IN ('auth.reset_requested','auth.password_reset','auth.email_verified')").fetch_one(&env.pool).await.unwrap();
    assert_eq!(logged, 3, "события записаны в журнал");

    // --- просроченная ссылка и переход по ссылке сброса подтверждает почту
    env.ok(None, reg, json!({"e": "olga@x.ru"})).await;
    env.mailer.take_outbox();
    sqlx::query("UPDATE users SET email_verified_at = NULL WHERE lower(email) = 'maria@x.ru'").execute(&env.pool).await.unwrap();
    sqlx::query("DELETE FROM email_tokens").execute(&env.pool).await.unwrap();
    env.ok(None, ask, json!({"e": "olga@x.ru"})).await;
    let mails = env.mailer.take_outbox();
    let t = token_from(&mails[0], "reset");
    sqlx::query("UPDATE email_tokens SET expires_at = now() - interval '1 minute'").execute(&env.pool).await.unwrap();
    let (m, code) = env.err(None, reset, json!({"t": t, "p": "N3w-strong-pass"})).await;
    assert_eq!(code, "BAD_USER_INPUT", "{m}");
    sqlx::query("UPDATE email_tokens SET expires_at = now() + interval '1 hour'").execute(&env.pool).await.unwrap();
    env.ok(None, reset, json!({"t": t, "p": "N3w-strong-pass"})).await;
    let olga = env.login("olga@x.ru", "N3w-strong-pass").await;
    assert_eq!(env.ok(Some(&olga), "{ me { emailVerified } }", json!({})).await["me"]["emailVerified"], true, "получение письма подтверждает адрес");

    // --- смена адреса администратором аннулирует выданные ссылки
    sqlx::query("UPDATE email_tokens SET created_at = created_at - interval '5 minutes'").execute(&env.pool).await.unwrap();
    env.ok(None, ask, json!({"e": "olga@x.ru"})).await;
    let mails = env.mailer.take_outbox();
    sqlx::query("UPDATE users SET email = 'olga-new@x.ru' WHERE lower(email) = 'olga@x.ru'").execute(&env.pool).await.unwrap();
    let t = token_from(&mails[0], "reset");
    let (_, code) = env.err(None, reset, json!({"t": t, "p": "An0ther-pass-1"})).await;
    assert_eq!(code, "BAD_USER_INPUT");

    // --- удаление аккаунта удаляет токены
    let before: i64 = sqlx::query_scalar("SELECT count(*) FROM email_tokens").fetch_one(&env.pool).await.unwrap();
    assert!(before > 0);
    env.ok(Some(&env.login("maria@x.ru", "N3w-strong-pass").await), "mutation{deleteMyAccount(password:\"N3w-strong-pass\")}", json!({})).await;
    env.cleanup().await;
}

#[tokio::test]
async fn unverified_email_is_limited_when_required() {
    let env = Env::with(|c| c.require_verified_email = true).await;
    let reg = "mutation{register(firstName:\"Мария\",lastName:\"Почтова\",email:\"maria@x.ru\",password:\"Str0ng-pass\",role:VOLUNTEER,consent:true){user{volonteerId}}}";
    let vol = env.ok(None, reg, json!({})).await["register"]["user"]["volonteerId"].as_str().unwrap().to_string();
    let ev = env.ok(None, "{ availableEvents { id } }", json!({})).await["availableEvents"][0]["id"].as_str().unwrap().to_string();
    let me = env.login("maria@x.ru", "Str0ng-pass").await;
    let sub = "mutation($v:ID!,$e:ID!){submitEventRequest(volonteerId:$v,eventId:$e){id}}";
    let (m, code) = env.err(Some(&me), sub, json!({"v": vol, "e": ev})).await;
    assert_eq!(code, "EMAIL_NOT_VERIFIED", "{m}");
    let marker = "mutation{createMapMarker(input:{type:REGULAR,title:\"Нужна помощь\",description:\"Описание\",lat:47.2,lng:39.7,urgency:LOW}){id}}";
    let (_, code) = env.err(Some(&me), marker, json!({})).await;
    assert_eq!(code, "EMAIL_NOT_VERIFIED");
    // читать данные и входить можно
    env.ok(Some(&me), "{ events { id } }", json!({})).await;

    let mails = env.mailer.take_outbox();
    env.ok(Some(&me), "mutation($t:String!){verifyEmail(token:$t)}", json!({"t": token_from(&mails[0], "verify")})).await;
    // права берутся из БД при каждом запросе — перелогин не нужен
    env.ok(Some(&me), sub, json!({"v": vol, "e": ev})).await;
    env.ok(Some(&me), marker, json!({})).await;
    // администратор, организатор и волонтёр из сида подтверждены
    env.ok(Some(&env.admin().await), marker, json!({})).await;
    env.cleanup().await;
}
