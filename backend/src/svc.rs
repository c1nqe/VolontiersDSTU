//! Бизнес-логика и запросы к PostgreSQL. Все проверки прав — здесь, на сервере.
use std::net::IpAddr;

use async_graphql::{Context, ID};
use chrono::{NaiveDate, Utc};
use serde_json::{json, Value};
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::{
    app::AppState,
    auth::{self, Viewer},
    error::{AppError, AppResult},
    media,
    model::*,
};

// ---------- Доступ к контексту ----------------------------------------------------
#[derive(Clone, Copy)]
pub struct ClientInfo {
    pub ip: IpAddr,
    pub want_token: bool,
}
/// Куда мутация складывает Set-Cookie для ответа.
#[derive(Clone, Default)]
pub struct CookieOut(pub std::sync::Arc<std::sync::Mutex<Option<String>>>);

pub fn st<'a>(ctx: &'a Context<'_>) -> &'a AppState { ctx.data_unchecked::<AppState>() }
pub fn viewer<'a>(ctx: &'a Context<'_>) -> Option<&'a Viewer> { ctx.data_opt::<Viewer>() }
pub fn need<'a>(ctx: &'a Context<'_>) -> AppResult<&'a Viewer> { viewer(ctx).ok_or(AppError::Unauthenticated) }
fn client(ctx: &Context<'_>) -> ClientInfo {
    ctx.data_opt::<ClientInfo>().copied().unwrap_or(ClientInfo { ip: IpAddr::from([127, 0, 0, 1]), want_token: false })
}
fn set_cookie(ctx: &Context<'_>, value: String) {
    if let Some(slot) = ctx.data_opt::<CookieOut>() {
        *slot.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(value);
    }
}

// ---------- Журнал аудита ------------------------------------------------------------
pub async fn audit(conn: &mut PgConnection, v: Option<&Viewer>, action: &str, entity: &str, id: Option<Uuid>, details: Value) -> AppResult<()> {
    sqlx::query("INSERT INTO audit_log (actor_user_id, actor_role, action, entity, entity_id, details) VALUES ($1,$2,$3,$4,$5,$6)")
        .bind(v.map(|v| v.user_id))
        .bind(v.map(|v| v.role))
        .bind(action)
        .bind(entity)
        .bind(id)
        .bind(details)
        .execute(conn)
        .await?;
    Ok(())
}

// ---------- Проверка ввода ---------------------------------------------------------------
fn clean(s: &str, field: &str, min: usize, max: usize) -> AppResult<String> {
    let t = s.trim();
    let n = t.chars().count();
    if n < min || n > max {
        return Err(AppError::validation(if min <= 1 {
            format!("Поле «{field}» обязательно и не должно превышать {max} символов")
        } else {
            format!("Поле «{field}» должно содержать от {min} до {max} символов")
        }));
    }
    if t.chars().any(|c| c.is_control() && c != '\n' && c != '\r' && c != '\t') {
        return Err(AppError::validation(format!("Поле «{field}» содержит недопустимые символы")));
    }
    Ok(t.to_string())
}
fn clean_opt(s: &Option<String>, field: &str, max: usize) -> AppResult<Option<String>> {
    match s.as_deref().map(str::trim) {
        None | Some("") => Ok(None),
        Some(v) => clean(v, field, 1, max).map(Some),
    }
}
fn normalize_email(e: &str) -> AppResult<String> {
    let e = e.trim().to_lowercase();
    let ok = e.len() <= 254 && e.len() >= 3 && e.matches('@').count() == 1
        && !e.starts_with('@') && !e.ends_with('@') && !e.contains(char::is_whitespace)
        && e.split('@').nth(1).map(|d| d.contains('.') && !d.starts_with('.') && !d.ends_with('.')).unwrap_or(false);
    if ok { Ok(e) } else { Err(AppError::validation("Укажите корректный адрес электронной почты")) }
}
fn finite(x: f64, field: &str) -> AppResult<f64> {
    if x.is_finite() { Ok(x) } else { Err(AppError::validation(format!("Поле «{field}» должно быть числом"))) }
}

// ---------- Пользователи и сессии ---------------------------------------------------------------
pub async fn user_by_id(pool: &PgPool, id: Uuid) -> AppResult<User> {
    let row = sqlx::query_as::<_, UserRow>(&format!("{USER_SELECT} WHERE u.id = $1")).bind(id).fetch_optional(pool).await?;
    row.map(User::from).ok_or_else(|| AppError::not_found("Пользователь не найден"))
}

pub async fn me(ctx: &Context<'_>) -> AppResult<Option<User>> {
    match viewer(ctx) {
        Some(v) => Ok(Some(user_by_id(&st(ctx).pool, v.user_id).await?)),
        None => Ok(None),
    }
}

pub async fn users_list(ctx: &Context<'_>) -> AppResult<Vec<User>> {
    if !need(ctx)?.is_admin() { return Err(AppError::Forbidden); }
    let rows = sqlx::query_as::<_, UserRow>(&format!("{USER_SELECT} ORDER BY u.created_at")).fetch_all(&st(ctx).pool).await?;
    Ok(rows.into_iter().map(User::from).collect())
}

fn start_session(ctx: &Context<'_>, user_id: Uuid, token_version: i32) -> AppResult<(String, String)> {
    let s = st(ctx);
    let (token, exp) = auth::issue_token(&s.cfg.jwt_secret, user_id, token_version, s.cfg.session_hours)?;
    set_cookie(ctx, auth::session_cookie(&token, s.cfg.session_hours * 3600, s.cfg.cookie_secure));
    let expires_at = chrono::DateTime::from_timestamp(exp, 0).map(rfc3339).unwrap_or_default();
    Ok((token, expires_at))
}

fn rate_limit(ctx: &Context<'_>, key: &'static str, limit: u32) -> AppResult<()> {
    if !st(ctx).limiter.allow(client(ctx).ip, key, limit, std::time::Duration::from_secs(60)) {
        return Err(AppError::TooManyRequests("Слишком много попыток. Подождите минуту и повторите.".into()));
    }
    Ok(())
}

/// Версия политики обработки персональных данных (docs/PRIVACY.md). Меняется при изменении политики.
pub const PRIVACY_POLICY_VERSION: &str = "2026-10-09";

const MAX_FAILED: i16 = 5;
const LOCK_MINUTES: i64 = 15;
const BAD_CREDENTIALS: &str = "Неверный email или пароль";

pub async fn login(ctx: &Context<'_>, email: &str, password: &str) -> AppResult<AuthPayload> {
    rate_limit(ctx, "login", 20)?;
    let pool = &st(ctx).pool;
    let email = email.trim().to_lowercase();
    if password.len() > 1024 { return Err(AppError::validation(BAD_CREDENTIALS)); }

    let row: Option<(Uuid, String, i32, i16, Option<chrono::DateTime<Utc>>)> = sqlx::query_as(
        "SELECT id, password_hash, token_version, failed_logins, locked_until FROM users WHERE lower(email) = $1 AND deleted_at IS NULL",
    ).bind(&email).fetch_optional(pool).await?;

    let Some((id, hash, tv, failed, locked_until)) = row else {
        let p = password.to_string();
        let _ = tokio::task::spawn_blocking(move || auth::dummy_verify(&p)).await;
        return Err(AppError::validation(BAD_CREDENTIALS));
    };
    if let Some(until) = locked_until {
        if until > Utc::now() {
            let mins = ((until - Utc::now()).num_seconds() + 59) / 60;
            return Err(AppError::TooManyRequests(format!("Учётная запись временно заблокирована из-за неверных паролей. Повторите через {mins} мин.")));
        }
    }
    let pw = password.to_string();
    let ok = tokio::task::spawn_blocking(move || auth::verify_password(&pw, &hash)).await.map_err(|e| anyhow::anyhow!("join: {e}"))?;
    let mut tx = pool.begin().await?;
    if !ok {
        let new_failed = failed + 1;
        if new_failed >= MAX_FAILED {
            sqlx::query("UPDATE users SET failed_logins = 0, locked_until = now() + make_interval(mins => $2) WHERE id = $1")
                .bind(id).bind(LOCK_MINUTES as i32).execute(&mut *tx).await?;
            audit(&mut tx, None, "auth.locked", "user", Some(id), json!({"minutes": LOCK_MINUTES})).await?;
        } else {
            sqlx::query("UPDATE users SET failed_logins = $2 WHERE id = $1").bind(id).bind(new_failed).execute(&mut *tx).await?;
            audit(&mut tx, None, "auth.login_failed", "user", Some(id), json!({"attempt": new_failed})).await?;
        }
        tx.commit().await?;
        return Err(AppError::validation(BAD_CREDENTIALS));
    }
    sqlx::query("UPDATE users SET failed_logins = 0, locked_until = NULL, last_login_at = now() WHERE id = $1").bind(id).execute(&mut *tx).await?;
    audit(&mut tx, None, "auth.login", "user", Some(id), json!({})).await?;
    tx.commit().await?;

    let (token, expires_at) = start_session(ctx, id, tv)?;
    Ok(AuthPayload { token: client(ctx).want_token.then_some(token), user: user_by_id(pool, id).await?, expires_at })
}

#[allow(clippy::too_many_arguments)]
pub async fn register(ctx: &Context<'_>, first: &str, last: &str, email: &str, password: &str, role: UserRole, consent: bool, organization_name: Option<String>) -> AppResult<AuthPayload> {
    rate_limit(ctx, "register", 10)?;
    if !consent {
        return Err(AppError::validation("Для регистрации необходимо согласие на обработку персональных данных"));
    }
    if role == UserRole::Admin {
        return Err(AppError::validation("Администратор не может быть создан через публичную регистрацию"));
    }
    let first = clean(first, "Имя", 1, 100)?;
    let last = clean(last, "Фамилия", 1, 100)?;
    let email = normalize_email(email)?;
    auth::validate_password(password, &email)?;
    let pool = &st(ctx).pool;
    let exists: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM users WHERE lower(email) = $1").bind(&email).fetch_optional(pool).await?;
    if exists.is_some() {
        return Err(AppError::conflict("Пользователь с таким адресом электронной почты уже зарегистрирован!"));
    }
    let pw = password.to_string();
    let hash = tokio::task::spawn_blocking(move || auth::hash_password(&pw)).await.map_err(|e| anyhow::anyhow!("join: {e}"))??;

    let mut tx = pool.begin().await?;
    let person_id: Uuid = sqlx::query_scalar("INSERT INTO persons (first_name, last_name) VALUES ($1,$2) RETURNING id")
        .bind(&first).bind(&last).fetch_one(&mut *tx).await?;
    let (mut org, mut vol): (Option<Uuid>, Option<Uuid>) = (None, None);
    match role {
        UserRole::Volunteer => {
            vol = Some(sqlx::query_scalar("INSERT INTO volonteers (person_id, email) VALUES ($1,$2) RETURNING id")
                .bind(person_id).bind(&email).fetch_one(&mut *tx).await.map_err(|e| match AppError::from(e) {
                    AppError::Conflict(_) => AppError::conflict("Волонтёр с таким адресом электронной почты уже существует"),
                    other => other,
                })?);
        }
        UserRole::Organizer => {
            let explicit = clean_opt(&organization_name, "Название организации", 200)?;
            if let Some(n) = &explicit {
                if n.chars().count() < 2 { return Err(AppError::validation("Название организации — от 2 до 200 символов")); }
            }
            let mut name = explicit.clone().unwrap_or_else(|| format!("Организация: {last} {first}"));
            let taken: Option<(Uuid,)> = sqlx::query_as("SELECT id FROM organizations WHERE lower(name) = lower($1)").bind(&name).fetch_optional(&mut *tx).await?;
            if taken.is_some() {
                if explicit.is_some() { return Err(AppError::conflict("Организация с таким названием уже зарегистрирована")); }
                name = format!("{name} ({email})");
            }
            org = Some(sqlx::query_scalar(
                "INSERT INTO organizations (name, contact_person, email, description) VALUES ($1,$2,$3,'Новый организатор социально-волонтёрских инициатив') RETURNING id",
            ).bind(&name).bind(format!("{last} {first}")).bind(&email).fetch_one(&mut *tx).await?);
        }
        UserRole::Admin => unreachable!(),
    }
    let user_id: Uuid = sqlx::query_scalar(
        "INSERT INTO users (person_id, email, password_hash, role, organization_id, volonteer_id, consent_version, consent_at) VALUES ($1,$2,$3,$4,$5,$6,$7,now()) RETURNING id",
    ).bind(person_id).bind(&email).bind(&hash).bind(role).bind(org).bind(vol).bind(PRIVACY_POLICY_VERSION).fetch_one(&mut *tx).await
        .map_err(|e| match AppError::from(e) {
            AppError::Conflict(_) => AppError::conflict("Пользователь с таким адресом электронной почты уже зарегистрирован!"),
            other => other,
        })?;
    audit(&mut tx, None, "auth.register", "user", Some(user_id), json!({"role": role, "consent": PRIVACY_POLICY_VERSION})).await?;
    tx.commit().await?;

    let (token, expires_at) = start_session(ctx, user_id, 0)?;
    Ok(AuthPayload { token: client(ctx).want_token.then_some(token), user: user_by_id(pool, user_id).await?, expires_at })
}

pub async fn logout(ctx: &Context<'_>) -> AppResult<bool> {
    if let Some(v) = viewer(ctx) {
        let pool = &st(ctx).pool;
        let mut tx = pool.begin().await?;
        sqlx::query("UPDATE users SET token_version = token_version + 1 WHERE id = $1").bind(v.user_id).execute(&mut *tx).await?;
        audit(&mut tx, Some(v), "auth.logout", "user", Some(v.user_id), json!({})).await?;
        tx.commit().await?;
    }
    set_cookie(ctx, auth::clear_cookie(st(ctx).cfg.cookie_secure));
    Ok(true)
}

pub async fn change_password(ctx: &Context<'_>, old: &str, new: &str) -> AppResult<bool> {
    rate_limit(ctx, "password", 10)?;
    let v = need(ctx)?;
    let pool = &st(ctx).pool;
    let (hash, email): (String, String) = sqlx::query_as("SELECT password_hash, email FROM users WHERE id = $1").bind(v.user_id).fetch_one(pool).await?;
    let o = old.to_string();
    let ok = tokio::task::spawn_blocking(move || auth::verify_password(&o, &hash)).await.map_err(|e| anyhow::anyhow!("join: {e}"))?;
    if !ok { return Err(AppError::validation("Текущий пароль указан неверно")); }
    auth::validate_password(new, &email)?;
    let n = new.to_string();
    let new_hash = tokio::task::spawn_blocking(move || auth::hash_password(&n)).await.map_err(|e| anyhow::anyhow!("join: {e}"))??;
    let mut tx = pool.begin().await?;
    let tv: i32 = sqlx::query_scalar("UPDATE users SET password_hash = $2, token_version = token_version + 1, failed_logins = 0 WHERE id = $1 RETURNING token_version")
        .bind(v.user_id).bind(new_hash).fetch_one(&mut *tx).await?;
    audit(&mut tx, Some(v), "auth.password_changed", "user", Some(v.user_id), json!({})).await?;
    tx.commit().await?;
    start_session(ctx, v.user_id, tv)?;
    Ok(true)
}

pub async fn session(ctx: &Context<'_>) -> AppResult<Option<Session>> {
    let Some(v) = viewer(ctx) else { return Ok(None) };
    let user = user_by_id(&st(ctx).pool, v.user_id).await?;
    let expires_at = chrono::DateTime::from_timestamp(v.exp, 0).map(rfc3339).unwrap_or_default();
    Ok(Some(Session { user, expires_at }))
}

// ---------- Организации ---------------------------------------------------------------------------
fn reveal_org(v: Option<&Viewer>, org: Uuid) -> bool { v.map(|v| v.can_act_for_org(org)).unwrap_or(false) }

pub async fn organizations_list(ctx: &Context<'_>) -> AppResult<Vec<Organization>> {
    let rows = sqlx::query_as::<_, OrganizationRow>(&format!("{ORG_SELECT} ORDER BY created_at, name")).fetch_all(&st(ctx).pool).await?;
    let v = viewer(ctx);
    Ok(rows.into_iter().map(|r| { let reveal = reveal_org(v, r.id); Organization::from_row(r, reveal) }).collect())
}

pub async fn organization_by_id(ctx: &Context<'_>, id: Uuid) -> AppResult<Organization> {
    let row = sqlx::query_as::<_, OrganizationRow>(&format!("{ORG_SELECT} WHERE id = $1")).bind(id).fetch_optional(&st(ctx).pool).await?
        .ok_or_else(|| AppError::not_found("Организация не найдена"))?;
    let reveal = reveal_org(viewer(ctx), row.id);
    Ok(Organization::from_row(row, reveal))
}

pub async fn register_organization(ctx: &Context<'_>, name: &str, contact: &str, email: &str, phone: &str, inn: Option<String>, description: Option<String>) -> AppResult<Organization> {
    let v = need(ctx)?;
    if !v.is_admin() { return Err(AppError::Forbidden); }
    let name = clean(name, "Название", 2, 200)?;
    let contact = clean(contact, "Контактное лицо", 1, 200)?;
    let email = normalize_email(email)?;
    let phone = clean(phone, "Телефон", 1, 40)?;
    let inn = clean_opt(&inn, "ИНН", 12)?;
    if let Some(i) = &inn {
        if !(i.chars().all(|c| c.is_ascii_digit()) && (i.len() == 10 || i.len() == 12)) {
            return Err(AppError::validation("ИНН должен состоять из 10 или 12 цифр"));
        }
    }
    let description = clean_opt(&description, "Описание", 2000)?;
    let mut tx = st(ctx).pool.begin().await?;
    let row = sqlx::query_as::<_, OrganizationRow>(
        "INSERT INTO organizations (name, inn, contact_person, email, phone, description) VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, name, inn, contact_person, email, phone, description, created_at",
    ).bind(&name).bind(&inn).bind(&contact).bind(&email).bind(&phone).bind(&description).fetch_one(&mut *tx).await
        .map_err(|e| match AppError::from(e) { AppError::Conflict(_) => AppError::conflict("Организация с таким названием уже существует"), o => o })?;
    audit(&mut tx, Some(v), "organization.register", "organization", Some(row.id), json!({"name": name})).await?;
    tx.commit().await?;
    Ok(Organization::from_row(row, true))
}

// ---------- Волонтёры -------------------------------------------------------------------------------
async fn org_has_volonteer(pool: &PgPool, org: Uuid, vol: Uuid) -> AppResult<bool> {
    Ok(sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS (SELECT 1 FROM volonteer_event_requests r JOIN events e ON e.id = r.event_id
                         WHERE e.organization_id = $1 AND r.volonteer_id = $2 AND r.status <> 'CANCELLED')",
    ).bind(org).bind(vol).fetch_one(pool).await?)
}

async fn vol_access(ctx: &Context<'_>, vol: Uuid) -> AppResult<VolAccess> {
    let Some(v) = viewer(ctx) else { return Ok(VolAccess::Public) };
    if v.can_act_for_volonteer(vol) { return Ok(VolAccess::Full); }
    if v.role == UserRole::Organizer {
        if let Some(org) = v.organization_id {
            if org_has_volonteer(&st(ctx).pool, org, vol).await? { return Ok(VolAccess::Organizer); }
        }
    }
    Ok(VolAccess::Public)
}

pub async fn volonteer_by_id(ctx: &Context<'_>, id: Uuid) -> AppResult<Volonteer> {
    let row = sqlx::query_as::<_, VolonteerRow>(&format!("{VOL_SELECT} WHERE v.id = $1")).bind(id).fetch_optional(&st(ctx).pool).await?
        .ok_or_else(|| AppError::not_found("Волонтёр не найден"))?;
    let access = vol_access(ctx, id).await?;
    Ok(Volonteer::from_row(row, access))
}

pub async fn volonteers_list(ctx: &Context<'_>) -> AppResult<Vec<Volonteer>> {
    let Some(v) = viewer(ctx) else { return Ok(vec![]) };
    let pool = &st(ctx).pool;
    let (rows, access) = match v.role {
        UserRole::Admin => (sqlx::query_as::<_, VolonteerRow>(&format!("{VOL_SELECT} ORDER BY v.created_at, p.last_name")).fetch_all(pool).await?, VolAccess::Full),
        UserRole::Volunteer => (sqlx::query_as::<_, VolonteerRow>(&format!("{VOL_SELECT} WHERE v.id = $1")).bind(v.volonteer_id).fetch_all(pool).await?, VolAccess::Full),
        UserRole::Organizer => (sqlx::query_as::<_, VolonteerRow>(&format!(
            "{VOL_SELECT} WHERE v.id IN (SELECT r.volonteer_id FROM volonteer_event_requests r JOIN events e ON e.id = r.event_id
                                          WHERE e.organization_id = $1 AND r.status <> 'CANCELLED') ORDER BY p.last_name"))
            .bind(v.organization_id).fetch_all(pool).await?, VolAccess::Organizer),
    };
    Ok(rows.into_iter().map(|r| Volonteer::from_row(r, access)).collect())
}

pub async fn register_volonteer(ctx: &Context<'_>, full_name: &str, email: &str, phone: &str, student_id: Option<String>, faculty: Option<String>, birth_date: Option<String>) -> AppResult<Volonteer> {
    let v = need(ctx)?;
    if !v.is_admin() { return Err(AppError::Forbidden); }
    let full = clean(full_name, "ФИО", 3, 300)?;
    let mut parts = full.split_whitespace();
    let last = parts.next().unwrap_or_default().to_string();
    let first = parts.next().ok_or_else(|| AppError::validation("Укажите фамилию и имя волонтёра"))?.to_string();
    let middle = { let rest: Vec<&str> = parts.collect(); if rest.is_empty() { None } else { Some(rest.join(" ")) } };
    let email = normalize_email(email)?;
    let phone = clean(phone, "Телефон", 1, 40)?;
    let student_id = clean_opt(&student_id, "Студенческий билет", 40)?;
    let faculty = clean_opt(&faculty, "Факультет", 200)?;
    let birth = match birth_date.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => Some(NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| AppError::validation("Дата рождения должна быть в формате ГГГГ-ММ-ДД"))?),
        None => None,
    };
    let mut tx = st(ctx).pool.begin().await?;
    let person_id: Uuid = sqlx::query_scalar("INSERT INTO persons (first_name, last_name, middle_name, birth_date) VALUES ($1,$2,$3,$4) RETURNING id")
        .bind(&first).bind(&last).bind(&middle).bind(birth).fetch_one(&mut *tx).await?;
    let id: Uuid = sqlx::query_scalar("INSERT INTO volonteers (person_id, email, phone, student_id, faculty) VALUES ($1,$2,$3,$4,$5) RETURNING id")
        .bind(person_id).bind(&email).bind(&phone).bind(&student_id).bind(&faculty).fetch_one(&mut *tx).await
        .map_err(|e| match AppError::from(e) { AppError::Conflict(_) => AppError::conflict("Волонтёр с таким адресом электронной почты уже существует"), o => o })?;
    audit(&mut tx, Some(v), "volonteer.register", "volonteer", Some(id), json!({})).await?;
    let row = sqlx::query_as::<_, VolonteerRow>(&format!("{VOL_SELECT} WHERE v.id = $1")).bind(id).fetch_one(&mut *tx).await?;
    tx.commit().await?;
    Ok(Volonteer::from_row(row, VolAccess::Full))
}

// ---------- События --------------------------------------------------------------------------------------
async fn fetch_event(conn: &mut PgConnection, id: Uuid) -> AppResult<Event> {
    sqlx::query_as::<_, EventRow>(&format!("{EVENT_SELECT} WHERE e.id = $1")).bind(id).fetch_optional(conn).await?
        .map(Event::from).ok_or_else(|| AppError::not_found("Событие не найдено"))
}

fn event_visible(v: Option<&Viewer>, status: EventStatus, org: Uuid) -> bool {
    matches!(status, EventStatus::Accepted | EventStatus::Closed) || v.map(|v| v.can_act_for_org(org)).unwrap_or(false)
}

pub async fn events_list(ctx: &Context<'_>, status: Option<EventStatus>) -> AppResult<Vec<Event>> {
    let v = viewer(ctx);
    let rows = sqlx::query_as::<_, EventRow>(&format!(
        "{EVENT_SELECT} WHERE (e.status IN ('ACCEPTED','CLOSED') OR $1 OR e.organization_id = $2)
            AND ($3::event_status IS NULL OR e.status = $3) ORDER BY e.created_at DESC, e.start_at"))
        .bind(v.map(|v| v.is_admin()).unwrap_or(false))
        .bind(v.and_then(|v| v.organization_id))
        .bind(status)
        .fetch_all(&st(ctx).pool).await?;
    Ok(rows.into_iter().map(Event::from).collect())
}

pub async fn events_of_org(ctx: &Context<'_>, org: Uuid) -> AppResult<Vec<Event>> {
    let all = events_list(ctx, None).await?;
    let org = gid(org);
    Ok(all.into_iter().filter(|e| e.organization_id == org).collect())
}

pub async fn event_by_id(ctx: &Context<'_>, id: Uuid) -> AppResult<Event> {
    let row = sqlx::query_as::<_, EventRow>(&format!("{EVENT_SELECT} WHERE e.id = $1")).bind(id).fetch_optional(&st(ctx).pool).await?
        .ok_or_else(|| AppError::not_found("Событие не найдено"))?;
    if !event_visible(viewer(ctx), row.status, row.organization_id) { return Err(AppError::not_found("Событие не найдено")); }
    Ok(row.into())
}

#[allow(clippy::too_many_arguments)]
pub async fn create_event(ctx: &Context<'_>, title: &str, description: &str, location: &str, start: &str, end: &str, required: i32, hours: f64, org: Uuid) -> AppResult<Event> {
    let v = need(ctx)?;
    if !v.can_act_for_org(org) { return Err(AppError::Forbidden); }
    let title = clean(title, "Название события", 3, 200)?;
    let description = clean(description, "Описание", 1, 4000)?;
    let location = clean(location, "Место проведения", 1, 300)?;
    let start_at = parse_when(start, false)?;
    let end_at = parse_when(end, true)?;
    if end_at < start_at { return Err(AppError::validation("Дата окончания не может быть раньше даты начала")); }
    if !(1..=10_000).contains(&required) { return Err(AppError::validation("Число волонтёров должно быть от 1 до 10 000")); }
    let hours = finite(hours, "Планируемые часы")?;
    if !(hours > 0.0 && hours <= 744.0) { return Err(AppError::validation("Планируемые часы — от 0,5 до 744")); }
    let mut tx = st(ctx).pool.begin().await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO events (organization_id, title, description, location, start_at, end_at, required_volunteers, planned_hours)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8::float8::numeric(6,1)) RETURNING id",
    ).bind(org).bind(&title).bind(&description).bind(&location).bind(start_at).bind(end_at).bind(required).bind(hours)
        .fetch_one(&mut *tx).await?;
    audit(&mut tx, Some(v), "event.create", "event", Some(id), json!({"title": title})).await?;
    let ev = fetch_event(&mut tx, id).await?;
    tx.commit().await?;
    Ok(ev)
}

async fn event_org(conn: &mut PgConnection, id: Uuid) -> AppResult<Uuid> {
    sqlx::query_scalar("SELECT organization_id FROM events WHERE id = $1").bind(id).fetch_optional(conn).await?
        .ok_or_else(|| AppError::not_found("Событие не найдено"))
}

async fn transition_event(ctx: &Context<'_>, id: Uuid, from: EventStatus, to: EventStatus, require_admin: bool, action: &str) -> AppResult<Event> {
    let v = need(ctx)?;
    let mut tx = st(ctx).pool.begin().await?;
    let org = event_org(&mut tx, id).await?;
    let allowed = if require_admin { v.is_admin() } else { v.can_act_for_org(org) };
    if !allowed { return Err(AppError::Forbidden); }
    let n = sqlx::query("UPDATE events SET status = $3 WHERE id = $1 AND status = $2").bind(id).bind(from).bind(to).execute(&mut *tx).await?.rows_affected();
    if n == 0 {
        return Err(AppError::conflict("Это действие недоступно для текущего статуса события"));
    }
    audit(&mut tx, Some(v), action, "event", Some(id), json!({"from": from, "to": to})).await?;
    let ev = fetch_event(&mut tx, id).await?;
    tx.commit().await?;
    Ok(ev)
}

pub async fn moderate_event(ctx: &Context<'_>, id: Uuid, status: EventStatus) -> AppResult<Event> {
    match status {
        EventStatus::Accepted | EventStatus::Cancelled => transition_event(ctx, id, EventStatus::Draft, status, true, "event.moderate").await,
        _ => Err(AppError::validation("Модерация допускает только статусы ACCEPTED и CANCELLED")),
    }
}
/// Отмена события организатором или администратором: DRAFT → CANCELLED или ACCEPTED → CANCELLED.
/// При отмене принятого события все открытые и принятые заявки отменяются каскадом (триггер БД).
pub async fn cancel_event(ctx: &Context<'_>, id: Uuid, reason: Option<String>) -> AppResult<Event> {
    let v = need(ctx)?;
    let reason = clean_opt(&reason, "Причина отмены", 500)?;
    let mut tx = st(ctx).pool.begin().await?;
    let org = event_org(&mut tx, id).await?;
    if !v.can_act_for_org(org) { return Err(AppError::Forbidden); }
    let affected: i64 = sqlx::query_scalar("SELECT count(*) FROM volonteer_event_requests WHERE event_id = $1 AND status IN ('OPEN','ACCEPTED')")
        .bind(id).fetch_one(&mut *tx).await?;
    let n = sqlx::query("UPDATE events SET status = 'CANCELLED', cancel_reason = $2 WHERE id = $1 AND status IN ('DRAFT','ACCEPTED')")
        .bind(id).bind(&reason).execute(&mut *tx).await?.rows_affected();
    if n == 0 { return Err(AppError::conflict("Отменить можно только событие в статусе DRAFT или ACCEPTED")); }
    audit(&mut tx, Some(v), "event.cancel", "event", Some(id), json!({"requestsCancelled": affected, "withReason": reason.is_some()})).await?;
    let ev = fetch_event(&mut tx, id).await?;
    tx.commit().await?;
    Ok(ev)
}

pub async fn close_event(ctx: &Context<'_>, id: Uuid) -> AppResult<Event> {
    transition_event(ctx, id, EventStatus::Accepted, EventStatus::Closed, false, "event.close").await
}

// ---------- Заявки -------------------------------------------------------------------------------------------
async fn fetch_request(conn: &mut PgConnection, id: Uuid) -> AppResult<VolonteerEventRequest> {
    sqlx::query_as::<_, RequestRow>(&format!("{REQUEST_SELECT} WHERE r.id = $1")).bind(id).fetch_optional(conn).await?
        .map(Into::into).ok_or_else(|| AppError::not_found("Заявка не найдена"))
}

pub async fn requests_list(ctx: &Context<'_>, vol: Option<Uuid>, event: Option<Uuid>, status: Option<RequestStatus>) -> AppResult<Vec<VolonteerEventRequest>> {
    let Some(v) = viewer(ctx) else { return Ok(vec![]) };
    let rows = sqlx::query_as::<_, RequestRow>(&format!(
        "{REQUEST_SELECT} WHERE ($1 OR e.organization_id = $2 OR r.volonteer_id = $3)
            AND ($4::uuid IS NULL OR r.volonteer_id = $4) AND ($5::uuid IS NULL OR r.event_id = $5)
            AND ($6::request_status IS NULL OR r.status = $6) ORDER BY r.created_at DESC"))
        .bind(v.is_admin())
        .bind(if v.role == UserRole::Organizer { v.organization_id } else { None })
        .bind(if v.role == UserRole::Volunteer { v.volonteer_id } else { None })
        .bind(vol).bind(event).bind(status)
        .fetch_all(&st(ctx).pool).await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn request_by_id(ctx: &Context<'_>, id: Uuid) -> AppResult<Option<VolonteerEventRequest>> {
    Ok(requests_list(ctx, None, None, None).await?.into_iter().find(|r| r.id.as_str() == id.to_string()))
}

pub async fn submit_request(ctx: &Context<'_>, vol: Uuid, event: Uuid, description: Option<String>) -> AppResult<VolonteerEventRequest> {
    let v = need(ctx)?;
    if !v.can_act_for_volonteer(vol) { return Err(AppError::Forbidden); }
    let description = clean_opt(&description, "Комментарий", 1000)?;
    let mut tx = st(ctx).pool.begin().await?;
    let hours: Option<f64> = sqlx::query_scalar("SELECT planned_hours::float8 FROM events WHERE id = $1").bind(event).fetch_optional(&mut *tx).await?;
    let hours = hours.ok_or_else(|| AppError::not_found("Событие не найдено"))?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO volonteer_event_requests (volonteer_id, event_id, description, requested_hours) VALUES ($1,$2,$3,$4::float8::numeric(6,1)) RETURNING id",
    ).bind(vol).bind(event).bind(&description).bind(hours).fetch_one(&mut *tx).await
        .map_err(|e| match AppError::from(e) {
            AppError::Conflict(m) if m == "Такая запись уже существует" => AppError::conflict("Заявка на это событие уже была подана ранее!"),
            o => o,
        })?;
    audit(&mut tx, Some(v), "request.submit", "request", Some(id), json!({"event": event})).await?;
    let r = fetch_request(&mut tx, id).await?;
    tx.commit().await?;
    Ok(r)
}

/// (организация события, волонтёр) заявки — для проверок прав.
async fn request_owner(conn: &mut PgConnection, id: Uuid) -> AppResult<(Uuid, Uuid)> {
    sqlx::query_as("SELECT e.organization_id, r.volonteer_id FROM volonteer_event_requests r JOIN events e ON e.id = r.event_id WHERE r.id = $1")
        .bind(id).fetch_optional(conn).await?.ok_or_else(|| AppError::not_found("Заявка не найдена"))
}

pub async fn moderate_request(ctx: &Context<'_>, id: Uuid, status: RequestStatus, reason: Option<String>) -> AppResult<VolonteerEventRequest> {
    let v = need(ctx)?;
    if !matches!(status, RequestStatus::Accepted | RequestStatus::Cancelled) {
        return Err(AppError::validation("Модерация допускает только статусы ACCEPTED и CANCELLED"));
    }
    let reason = clean_opt(&reason, "Причина отказа", 500)?;
    let mut tx = st(ctx).pool.begin().await?;
    let (org, _) = request_owner(&mut tx, id).await?;
    if !v.can_act_for_org(org) { return Err(AppError::Forbidden); }
    let n = sqlx::query("UPDATE volonteer_event_requests SET status = $2, rejection_reason = $3 WHERE id = $1 AND (status = 'OPEN' OR ($2::request_status = 'CANCELLED' AND status = 'ACCEPTED'))")
        .bind(id).bind(status).bind(if status == RequestStatus::Cancelled { reason } else { None }).execute(&mut *tx).await?.rows_affected();
    if n == 0 { return Err(AppError::conflict("Решение по заявке уже принято и изменить его нельзя")); }
    audit(&mut tx, Some(v), "request.moderate", "request", Some(id), json!({"to": status})).await?;
    let r = fetch_request(&mut tx, id).await?;
    tx.commit().await?;
    Ok(r)
}

pub async fn confirm_work(ctx: &Context<'_>, id: Uuid, hours: f64) -> AppResult<VolonteerEventRequest> {
    let v = need(ctx)?;
    let hours = finite(hours, "Часы")?;
    if !(0.0..=744.0).contains(&hours) { return Err(AppError::validation("Подтверждённые часы — от 0 до 744")); }
    let mut tx = st(ctx).pool.begin().await?;
    let (org, _) = request_owner(&mut tx, id).await?;
    if !v.can_act_for_org(org) { return Err(AppError::Forbidden); }
    // идемпотентность: повторное подтверждение даёт 0 строк → понятная ошибка, часы не удваиваются
    let n = sqlx::query("UPDATE volonteer_event_requests SET status = 'CONFIRMED', confirmed_hours = $2::float8::numeric(6,1) WHERE id = $1 AND status = 'ACCEPTED'")
        .bind(id).bind(hours).execute(&mut *tx).await?.rows_affected();
    if n == 0 { return Err(AppError::conflict("Подтвердить часы можно только по согласованной заявке, и только один раз")); }
    audit(&mut tx, Some(v), "request.confirm", "request", Some(id), json!({"hours": hours})).await?;
    let r = fetch_request(&mut tx, id).await?;
    tx.commit().await?;
    Ok(r)
}

pub async fn cancel_request(ctx: &Context<'_>, id: Uuid) -> AppResult<VolonteerEventRequest> {
    let v = need(ctx)?;
    let mut tx = st(ctx).pool.begin().await?;
    let (org, vol) = request_owner(&mut tx, id).await?;
    if !(v.can_act_for_org(org) || v.can_act_for_volonteer(vol)) { return Err(AppError::Forbidden); }
    let n = sqlx::query("UPDATE volonteer_event_requests SET status = 'CANCELLED' WHERE id = $1 AND status IN ('OPEN','ACCEPTED')").bind(id).execute(&mut *tx).await?.rows_affected();
    if n == 0 { return Err(AppError::conflict("Отменить можно только заявку, по которой ещё не подтверждены часы")); }
    audit(&mut tx, Some(v), "request.cancel", "request", Some(id), json!({"by": if v.can_act_for_volonteer(vol) { "volonteer" } else { "organizer" }})).await?;
    let r = fetch_request(&mut tx, id).await?;
    tx.commit().await?;
    Ok(r)
}

// ---------- Отзывы ------------------------------------------------------------------------------------------------
pub const MAX_REVIEW_LENGTH: usize = 1000;

pub async fn reviews_list(ctx: &Context<'_>, event: Option<Uuid>, vol: Option<Uuid>) -> AppResult<Vec<EventReview>> {
    let rows = sqlx::query_as::<_, ReviewRow>(&format!(
        "{REVIEW_SELECT} WHERE ($1::uuid IS NULL OR event_id = $1) AND ($2::uuid IS NULL OR volonteer_id = $2) ORDER BY created_at DESC"))
        .bind(event).bind(vol).fetch_all(&st(ctx).pool).await?;
    Ok(rows.into_iter().map(Into::into).collect())
}

pub async fn submit_review(ctx: &Context<'_>, event: Uuid, vol: Uuid, rating: i32, text: &str) -> AppResult<EventReview> {
    let v = need(ctx)?;
    if !v.can_act_for_volonteer(vol) { return Err(AppError::Forbidden); }
    if !(1..=5).contains(&rating) { return Err(AppError::validation("Поставьте оценку от 1 до 5 звёзд.")); }
    let text = text.trim().to_string();
    let n = text.chars().count();
    if n < 10 { return Err(AppError::validation("Напишите отзыв хотя бы из 10 символов.")); }
    if n > MAX_REVIEW_LENGTH { return Err(AppError::validation(format!("Отзыв не должен превышать {MAX_REVIEW_LENGTH} символов."))); }
    let pool = &st(ctx).pool;
    let eligible: bool = sqlx::query_scalar(
        "SELECT EXISTS (SELECT 1 FROM volonteer_event_requests r JOIN events e ON e.id = r.event_id
                         WHERE r.volonteer_id = $1 AND r.event_id = $2 AND (r.status = 'CONFIRMED' OR (r.status = 'ACCEPTED' AND e.status = 'CLOSED')))",
    ).bind(vol).bind(event).fetch_one(pool).await?;
    if !eligible {
        return Err(AppError::conflict("Оставить отзыв можно после участия: организатор должен подтвердить ваши часы или закрыть мероприятие."));
    }
    let mut tx = pool.begin().await?;
    let name: String = sqlx::query_scalar("SELECT concat_ws(' ', p.last_name, p.first_name, p.middle_name) FROM volonteers v JOIN persons p ON p.id = v.person_id WHERE v.id = $1")
        .bind(vol).fetch_one(&mut *tx).await?;
    let row = sqlx::query_as::<_, ReviewRow>(
        "INSERT INTO event_reviews (event_id, volonteer_id, author_name, rating, text) VALUES ($1,$2,$3,$4,$5)
         ON CONFLICT (event_id, volonteer_id) DO UPDATE SET rating = EXCLUDED.rating, text = EXCLUDED.text, updated_at = now()
         RETURNING id, event_id, volonteer_id, author_name, rating, text, created_at, updated_at",
    ).bind(event).bind(vol).bind(name).bind(rating as i16).bind(&text).fetch_one(&mut *tx).await?;
    audit(&mut tx, Some(v), "review.save", "review", Some(row.id), json!({"event": event, "rating": rating})).await?;
    tx.commit().await?;
    Ok(row.into())
}

pub async fn delete_review(ctx: &Context<'_>, id: Uuid) -> AppResult<bool> {
    let v = need(ctx)?;
    let mut tx = st(ctx).pool.begin().await?;
    let vol: Uuid = sqlx::query_scalar("SELECT volonteer_id FROM event_reviews WHERE id = $1").bind(id).fetch_optional(&mut *tx).await?
        .ok_or_else(|| AppError::not_found("Отзыв не найден"))?;
    if !v.can_act_for_volonteer(vol) { return Err(AppError::Forbidden); }
    sqlx::query("DELETE FROM event_reviews WHERE id = $1").bind(id).execute(&mut *tx).await?;
    audit(&mut tx, Some(v), "review.delete", "review", Some(id), json!({})).await?;
    tx.commit().await?;
    Ok(true)
}

// ---------- Выписка ------------------------------------------------------------------------------------------------------
pub async fn statement(ctx: &Context<'_>, vol: Uuid, start: &str, end: &str) -> AppResult<StatementReport> {
    let v = need(ctx)?;
    if !v.can_act_for_volonteer(vol) { return Err(AppError::Forbidden); }
    let start_at = if start.trim().is_empty() { parse_when("2020-01-01", false)? } else { parse_when(start, false)? };
    let end_at = if end.trim().is_empty() { parse_when("2100-12-31", true)? } else { parse_when(end, true)? };
    let pool = &st(ctx).pool;
    let rows: Vec<(String, String, chrono::DateTime<Utc>, String, f64)> = sqlx::query_as(
        "SELECT e.title, o.name, e.start_at, e.location, r.confirmed_hours::float8
           FROM volonteer_event_requests r JOIN events e ON e.id = r.event_id JOIN organizations o ON o.id = e.organization_id
          WHERE r.volonteer_id = $1 AND r.status = 'CONFIRMED' AND e.status = 'CLOSED' AND e.start_at BETWEEN $2 AND $3
          ORDER BY e.start_at",
    ).bind(vol).bind(start_at).bind(end_at).fetch_all(pool).await?;
    let items: Vec<StatementReportItem> = rows.into_iter().map(|(name, org, at, loc, h)| StatementReportItem {
        event_name: name, organization_name: org, event_date: msk_date(at), location: loc, confirmed_hours: h }).collect();
    let total: f64 = items.iter().map(|i| i.confirmed_hours).sum();
    let volunteer = volonteer_by_id(ctx, vol).await?;
    Ok(StatementReport {
        volonteer: volunteer.clone(), volunteer, start_date: start.to_string(), end_date: end.to_string(),
        generated_at: msk(Utc::now()).format("%d.%m.%Y").to_string(), total_hours: total, closed_events_count: items.len() as i32, items,
    })
}

// ---------- Карта ------------------------------------------------------------------------------------------------------------
fn photos_visible(ctx: &Context<'_>) -> bool { viewer(ctx).is_some() || st(ctx).cfg.public_marker_photos }

async fn assemble_markers(ctx: &Context<'_>, rows: Vec<MarkerRow>) -> AppResult<Vec<MapMarker>> {
    let pool = &st(ctx).pool;
    let ids: Vec<Uuid> = rows.iter().map(|r| r.id).collect();
    let photos: Vec<(Uuid, Uuid)> = if photos_visible(ctx) {
        sqlx::query_as("SELECT marker_id, id FROM photos WHERE purpose = 'MARKER' AND marker_id = ANY($1) ORDER BY marker_id, position").bind(&ids).fetch_all(pool).await?
    } else { vec![] };
    let closures: Vec<ClosureRow> = if viewer(ctx).is_some() {
        sqlx::query_as(
            "SELECT DISTINCT ON (marker_id) marker_id, photo_id, note, target_status, submitted_by, submitted_by_name, submitted_at, approved_at, approved_by, rejected_at, reject_reason
               FROM marker_closures WHERE marker_id = ANY($1) ORDER BY marker_id, submitted_at DESC",
        ).bind(&ids).fetch_all(pool).await?
    } else { vec![] };
    Ok(rows.into_iter().map(|r| {
        let closure = closures.iter().position(|c| c.marker_id == r.id);
        let proof = closure.map(|i| ClosureProof::from(ClosureRow { ..clone_closure(&closures[i]) }));
        MapMarker {
            id: gid(r.id), kind: r.kind, status: r.status, title: r.title, description: r.description, lat: r.lat, lng: r.lng,
            urgency: r.urgency, contact_phone: r.contact_phone, last_seen_date: opt_date(r.last_seen_date), last_seen_location: r.last_seen_location,
            photos: photos.iter().filter(|(m, _)| *m == r.id).map(|(_, p)| photo_url(*p)).collect(),
            closure_proof: proof, created_by: r.created_by.map(gid), created_by_name: r.created_by_name, created_at: rfc3339(r.created_at),
        }
    }).collect())
}
fn clone_closure(c: &ClosureRow) -> ClosureRow {
    ClosureRow {
        marker_id: c.marker_id, photo_id: c.photo_id, note: c.note.clone(), target_status: c.target_status, submitted_by: c.submitted_by,
        submitted_by_name: c.submitted_by_name.clone(), submitted_at: c.submitted_at, approved_at: c.approved_at, approved_by: c.approved_by.clone(),
        rejected_at: c.rejected_at, reject_reason: c.reject_reason.clone(),
    }
}

pub async fn markers_list(ctx: &Context<'_>, kind: Option<MapMarkerType>) -> AppResult<Vec<MapMarker>> {
    let rows = sqlx::query_as::<_, MarkerRow>(&format!("{MARKER_SELECT} WHERE ($1::marker_type IS NULL OR type = $1) ORDER BY created_at DESC"))
        .bind(kind).fetch_all(&st(ctx).pool).await?;
    assemble_markers(ctx, rows).await
}

async fn marker_one(ctx: &Context<'_>, id: Uuid) -> AppResult<MapMarker> {
    let row = sqlx::query_as::<_, MarkerRow>(&format!("{MARKER_SELECT} WHERE id = $1")).bind(id).fetch_optional(&st(ctx).pool).await?
        .ok_or_else(|| AppError::not_found("Метка не найдена"))?;
    Ok(assemble_markers(ctx, vec![row]).await?.remove(0))
}

pub async fn create_marker(ctx: &Context<'_>, input: MapMarkerInput) -> AppResult<MapMarker> {
    let v = need(ctx)?;
    let title = clean(&input.title, "Заголовок", 3, 200)?;
    let description = clean(&input.description, "Описание", 1, 4000)?;
    let lat = finite(input.lat, "Широта")?;
    let lng = finite(input.lng, "Долгота")?;
    if !(-90.0..=90.0).contains(&lat) || !(-180.0..=180.0).contains(&lng) { return Err(AppError::validation("Координаты вне допустимого диапазона")); }
    let phone = clean_opt(&input.contact_phone, "Телефон", 40)?;
    let seen_loc = clean_opt(&input.last_seen_location, "Место последнего появления", 300)?;
    let seen_date = match input.last_seen_date.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(s) => Some(NaiveDate::parse_from_str(s, "%Y-%m-%d").map_err(|_| AppError::validation("Дата должна быть в формате ГГГГ-ММ-ДД"))?),
        None => None,
    };
    let photo_inputs = input.photos.unwrap_or_default();
    if !photo_inputs.is_empty() && input.kind != MapMarkerType::SearchRescue {
        return Err(AppError::validation("Фотографии прикрепляются только к меткам поисково-спасательных операций"));
    }
    let photos = media::process_many(photo_inputs).await?;

    let mut tx = st(ctx).pool.begin().await?;
    let id: Uuid = sqlx::query_scalar(
        "INSERT INTO map_markers (type, title, description, lat, lng, urgency, contact_phone, last_seen_date, last_seen_location, created_by, created_by_name)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING id",
    ).bind(input.kind).bind(&title).bind(&description).bind(lat).bind(lng).bind(input.urgency).bind(&phone).bind(seen_date).bind(&seen_loc)
        .bind(v.user_id).bind(&v.full_name).fetch_one(&mut *tx).await?;
    for (i, p) in photos.iter().enumerate() {
        sqlx::query("INSERT INTO photos (marker_id, purpose, position, content_type, data, size_bytes, sha256, uploaded_by) VALUES ($1,'MARKER',$2,$3,$4,$5,$6,$7)")
            .bind(id).bind(i as i16).bind(p.content_type).bind(&p.bytes).bind(p.bytes.len() as i32).bind(&p.sha256).bind(v.user_id)
            .execute(&mut *tx).await?;
    }
    audit(&mut tx, Some(v), "marker.create", "marker", Some(id), json!({"type": input.kind, "photos": photos.len()})).await?;
    tx.commit().await?;
    marker_one(ctx, id).await
}

pub async fn request_marker_close(ctx: &Context<'_>, id: Uuid, photo: Option<String>, note: &str, target: MapMarkerStatus) -> AppResult<MapMarker> {
    let v = need(ctx)?;
    if !matches!(target, MapMarkerStatus::Found | MapMarkerStatus::Closed) {
        return Err(AppError::validation("Итоговый статус — FOUND или CLOSED"));
    }
    let note = clean(note, "Комментарий", 0, 2000)?;
    let photo = match photo.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        Some(p) => Some(media::process_many(vec![p.to_string()]).await?.remove(0)),
        None => None,
    };
    let mut tx = st(ctx).pool.begin().await?;
    let kind: MapMarkerType = sqlx::query_scalar("SELECT type FROM map_markers WHERE id = $1").bind(id).fetch_optional(&mut *tx).await?
        .ok_or_else(|| AppError::not_found("Метка не найдена"))?;
    if kind != MapMarkerType::SearchRescue { return Err(AppError::validation("Отчёт о закрытии подаётся только по меткам ПСО")); }
    if photo.is_none() { return Err(AppError::validation("Приложите фотографию — подтверждение завершения операции")); }
    let n = sqlx::query("UPDATE map_markers SET status = 'PENDING_APPROVAL' WHERE id = $1 AND status = 'ACTIVE'").bind(id).execute(&mut *tx).await?.rows_affected();
    if n == 0 { return Err(AppError::conflict("Метка уже закрыта или ожидает согласования")); }
    let photo_id = match &photo {
        Some(p) => Some(sqlx::query_scalar::<_, Uuid>(
            "INSERT INTO photos (marker_id, purpose, position, content_type, data, size_bytes, sha256, uploaded_by) VALUES ($1,'CLOSURE',0,$2,$3,$4,$5,$6) RETURNING id",
        ).bind(id).bind(p.content_type).bind(&p.bytes).bind(p.bytes.len() as i32).bind(&p.sha256).bind(v.user_id).fetch_one(&mut *tx).await?),
        None => None,
    };
    sqlx::query("INSERT INTO marker_closures (marker_id, photo_id, note, target_status, submitted_by, submitted_by_name) VALUES ($1,$2,$3,$4,$5,$6)")
        .bind(id).bind(photo_id).bind(&note).bind(target).bind(v.user_id).bind(&v.full_name).execute(&mut *tx).await?;
    audit(&mut tx, Some(v), "marker.close_requested", "marker", Some(id), json!({"target": target})).await?;
    tx.commit().await?;
    marker_one(ctx, id).await
}

pub async fn approve_marker_close(ctx: &Context<'_>, id: Uuid) -> AppResult<MapMarker> {
    let v = need(ctx)?;
    if !v.is_admin() { return Err(AppError::Forbidden); }
    let mut tx = st(ctx).pool.begin().await?;
    let target: Option<MapMarkerStatus> = sqlx::query_scalar(
        "SELECT target_status FROM marker_closures WHERE marker_id = $1 AND approved_at IS NULL AND rejected_at IS NULL ORDER BY submitted_at DESC LIMIT 1",
    ).bind(id).fetch_optional(&mut *tx).await?;
    let target = target.ok_or_else(|| AppError::conflict("Нет отчёта, ожидающего согласования"))?;
    let n = sqlx::query("UPDATE map_markers SET status = $2 WHERE id = $1 AND status = 'PENDING_APPROVAL'").bind(id).bind(target).execute(&mut *tx).await?.rows_affected();
    if n == 0 { return Err(AppError::conflict("Метка не ожидает согласования")); }
    sqlx::query("UPDATE marker_closures SET approved_at = now(), approved_by = $2
                  WHERE id = (SELECT id FROM marker_closures WHERE marker_id = $1 AND approved_at IS NULL AND rejected_at IS NULL ORDER BY submitted_at DESC LIMIT 1)")
        .bind(id).bind(&v.full_name).execute(&mut *tx).await?;
    audit(&mut tx, Some(v), "marker.close_approved", "marker", Some(id), json!({"status": target, "removed": true})).await?;
    // Решение заказчика: закрытая ПСО исчезает сразу — метка, фото и отчёт удаляются из БД
    let gone = remove_search_marker(&mut tx, id, target).await?;
    tx.commit().await?;
    Ok(gone)
}

/// Удаляет закрытую метку ПСО вместе с фотографиями и отчётом о закрытии (каскадом БД).
/// Возвращает «снимок» метки без фото — чтобы ответить на мутацию.
async fn remove_search_marker(conn: &mut PgConnection, id: Uuid, final_status: MapMarkerStatus) -> AppResult<MapMarker> {
    let r = sqlx::query_as::<_, MarkerRow>(&format!("{MARKER_SELECT} WHERE id = $1")).bind(id).fetch_optional(&mut *conn).await?
        .ok_or_else(|| AppError::not_found("Метка не найдена"))?;
    sqlx::query("DELETE FROM map_markers WHERE id = $1").bind(id).execute(&mut *conn).await?;
    Ok(MapMarker {
        id: gid(r.id), kind: r.kind, status: final_status, title: r.title, description: r.description, lat: r.lat, lng: r.lng,
        urgency: r.urgency, contact_phone: None, last_seen_date: None, last_seen_location: None,
        photos: vec![], closure_proof: None, created_by: None, created_by_name: String::new(), created_at: rfc3339(r.created_at),
    })
}

pub async fn reject_marker_close(ctx: &Context<'_>, id: Uuid, reason: Option<String>) -> AppResult<MapMarker> {
    let v = need(ctx)?;
    if !v.is_admin() { return Err(AppError::Forbidden); }
    let reason = clean_opt(&reason, "Причина", 500)?.unwrap_or_else(|| "Недостаточно подтверждающих материалов".into());
    let mut tx = st(ctx).pool.begin().await?;
    let n = sqlx::query("UPDATE map_markers SET status = 'ACTIVE' WHERE id = $1 AND status = 'PENDING_APPROVAL'").bind(id).execute(&mut *tx).await?.rows_affected();
    if n == 0 { return Err(AppError::conflict("Метка не ожидает согласования")); }
    sqlx::query("UPDATE marker_closures SET rejected_at = now(), reject_reason = $2
                  WHERE id = (SELECT id FROM marker_closures WHERE marker_id = $1 AND approved_at IS NULL AND rejected_at IS NULL ORDER BY submitted_at DESC LIMIT 1)")
        .bind(id).bind(&reason).execute(&mut *tx).await?;
    audit(&mut tx, Some(v), "marker.close_rejected", "marker", Some(id), json!({"reason": reason})).await?;
    tx.commit().await?;
    marker_one(ctx, id).await
}

/// Закрытие обычной метки: автор или администратор. Метки ПСО закрываются только через отчёт.
pub async fn close_marker(ctx: &Context<'_>, id: Uuid) -> AppResult<MapMarker> {
    let v = need(ctx)?;
    let mut tx = st(ctx).pool.begin().await?;
    let (kind, owner): (MapMarkerType, Option<Uuid>) = sqlx::query_as("SELECT type, created_by FROM map_markers WHERE id = $1").bind(id).fetch_optional(&mut *tx).await?
        .ok_or_else(|| AppError::not_found("Метка не найдена"))?;
    if kind == MapMarkerType::SearchRescue && !v.is_admin() {
        return Err(AppError::Forbidden);
    }
    if !(v.is_admin() || owner == Some(v.user_id)) { return Err(AppError::Forbidden); }
    let n = sqlx::query("UPDATE map_markers SET status = 'CLOSED' WHERE id = $1 AND status = 'ACTIVE'").bind(id).execute(&mut *tx).await?.rows_affected();
    if n == 0 { return Err(AppError::conflict("Метка уже закрыта или ожидает согласования")); }
    audit(&mut tx, Some(v), "marker.close", "marker", Some(id), json!({"removed": kind == MapMarkerType::SearchRescue})).await?;
    if kind == MapMarkerType::SearchRescue {
        let gone = remove_search_marker(&mut tx, id, MapMarkerStatus::Closed).await?;
        tx.commit().await?;
        return Ok(gone);
    }
    tx.commit().await?;
    marker_one(ctx, id).await
}

pub async fn delete_marker(ctx: &Context<'_>, id: Uuid) -> AppResult<bool> {
    let v = need(ctx)?;
    if !v.is_admin() { return Err(AppError::Forbidden); }
    let mut tx = st(ctx).pool.begin().await?;
    let n = sqlx::query("DELETE FROM map_markers WHERE id = $1").bind(id).execute(&mut *tx).await?.rows_affected();
    if n == 0 { return Err(AppError::not_found("Метка не найдена")); }
    audit(&mut tx, Some(v), "marker.delete", "marker", Some(id), json!({})).await?;
    tx.commit().await?;
    Ok(true)
}

// ---------- Персональные данные: выгрузка и удаление (152-ФЗ) -------------------------------------------------
/// Все данные пользователя о нём самом одним JSON-документом (право на доступ к данным).
pub async fn export_my_data(ctx: &Context<'_>) -> AppResult<String> {
    rate_limit(ctx, "export", 10)?;
    let v = need(ctx)?;
    let mut tx = st(ctx).pool.begin().await?;
    let account: Value = sqlx::query_scalar(
        "SELECT to_jsonb(t) FROM (SELECT u.email, u.role, u.created_at AS \"registeredAt\", u.last_login_at AS \"lastLoginAt\",
                u.consent_at AS \"consentAt\", u.consent_version AS \"consentVersion\",
                p.first_name AS \"firstName\", p.last_name AS \"lastName\", p.middle_name AS \"middleName\", p.birth_date AS \"birthDate\"
           FROM users u JOIN persons p ON p.id = u.person_id WHERE u.id = $1) t",
    ).bind(v.user_id).fetch_one(&mut *tx).await?;
    let volunteer: Option<Value> = match v.volonteer_id {
        Some(id) => sqlx::query_scalar("SELECT to_jsonb(t) FROM (SELECT phone, student_id AS \"studentId\", faculty FROM volonteers WHERE id = $1) t").bind(id).fetch_optional(&mut *tx).await?,
        None => None,
    };
    let organization: Option<Value> = match v.organization_id {
        Some(id) => sqlx::query_scalar("SELECT to_jsonb(t) FROM (SELECT name, inn, contact_person AS \"contactPerson\", email, phone, description FROM organizations WHERE id = $1) t").bind(id).fetch_optional(&mut *tx).await?,
        None => None,
    };
    let requests: Value = sqlx::query_scalar(
        "SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.\"createdAt\"), '[]'::jsonb) FROM (
            SELECT e.title AS event, r.status, r.description, r.requested_hours::float8 AS \"requestedHours\", r.confirmed_hours::float8 AS \"confirmedHours\", r.created_at AS \"createdAt\"
              FROM volonteer_event_requests r JOIN events e ON e.id = r.event_id WHERE r.volonteer_id = $1) t",
    ).bind(v.volonteer_id).fetch_one(&mut *tx).await?;
    let reviews: Value = sqlx::query_scalar(
        "SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.\"createdAt\"), '[]'::jsonb) FROM (
            SELECT e.title AS event, rv.rating, rv.text, rv.created_at AS \"createdAt\"
              FROM event_reviews rv JOIN events e ON e.id = rv.event_id WHERE rv.volonteer_id = $1) t",
    ).bind(v.volonteer_id).fetch_one(&mut *tx).await?;
    let markers: Value = sqlx::query_scalar(
        "SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.\"createdAt\"), '[]'::jsonb) FROM (
            SELECT m.type, m.status, m.title, m.description, m.lat, m.lng, m.contact_phone AS \"contactPhone\", m.created_at AS \"createdAt\",
                   (SELECT count(*) FROM photos p WHERE p.marker_id = m.id AND p.uploaded_by = $1) AS \"photosUploaded\"
              FROM map_markers m WHERE m.created_by = $1) t",
    ).bind(v.user_id).fetch_one(&mut *tx).await?;
    let activity: Value = sqlx::query_scalar(
        "SELECT COALESCE(jsonb_agg(to_jsonb(t) ORDER BY t.at), '[]'::jsonb) FROM (
            SELECT at, action, entity FROM audit_log WHERE actor_user_id = $1 OR (entity = 'user' AND entity_id = $1) ORDER BY at DESC LIMIT 1000) t",
    ).bind(v.user_id).fetch_one(&mut *tx).await?;
    audit(&mut tx, Some(v), "account.export", "user", Some(v.user_id), json!({})).await?;
    tx.commit().await?;
    let doc = json!({
        "exportedAt": rfc3339(Utc::now()),
        "privacyPolicyVersion": PRIVACY_POLICY_VERSION,
        "account": account,
        "volunteerProfile": volunteer,
        "organization": organization,
        "eventRequests": requests,
        "eventReviews": reviews,
        "mapMarkers": markers,
        "activityLog": activity,
    });
    Ok(serde_json::to_string_pretty(&doc).map_err(|e| anyhow::anyhow!("json: {e}"))?)
}

const DELETED_NAME: (&str, &str) = ("пользователь", "Удалённый");

/// Удаление учётной записи (право на удаление): персональные данные обезличиваются сразу.
/// Что остаётся: обезличенные заявки и часы (нужны организаторам для отчётности), псевдонимный журнал аудита.
pub async fn delete_my_account(ctx: &Context<'_>, password: &str) -> AppResult<bool> {
    rate_limit(ctx, "delete", 5)?;
    let v = need(ctx)?;
    if v.is_admin() {
        return Err(AppError::validation("Администратор не может удалить себя из приложения. Попросите другого администратора."));
    }
    let pool = &st(ctx).pool;
    let hash: String = sqlx::query_scalar("SELECT password_hash FROM users WHERE id = $1 AND deleted_at IS NULL").bind(v.user_id).fetch_optional(pool).await?
        .ok_or(AppError::Unauthenticated)?;
    let pw = password.to_string();
    if !tokio::task::spawn_blocking(move || auth::verify_password(&pw, &hash)).await.map_err(|e| anyhow::anyhow!("join: {e}"))? {
        return Err(AppError::validation("Пароль указан неверно"));
    }
    let (first, last) = DELETED_NAME;
    let tombstone = format!("{last} {first}");
    let mut tx = pool.begin().await?;
    let person_id: Uuid = sqlx::query_scalar("SELECT person_id FROM users WHERE id = $1").bind(v.user_id).fetch_one(&mut *tx).await?;

    if let Some(org) = v.organization_id {
        let active: i64 = sqlx::query_scalar("SELECT count(*) FROM events WHERE organization_id = $1 AND status = 'ACCEPTED'").bind(org).fetch_one(&mut *tx).await?;
        if active > 0 {
            return Err(AppError::conflict("Сначала отмените или закройте активные события организации"));
        }
        sqlx::query("UPDATE events SET status = 'CANCELLED', cancel_reason = 'Организатор удалил учётную запись' WHERE organization_id = $1 AND status = 'DRAFT'")
            .bind(org).execute(&mut *tx).await?;
        let others: i64 = sqlx::query_scalar("SELECT count(*) FROM users WHERE organization_id = $1 AND id <> $2 AND deleted_at IS NULL").bind(org).bind(v.user_id).fetch_one(&mut *tx).await?;
        if others == 0 {
            sqlx::query("UPDATE organizations SET contact_person = '', email = '', phone = '' WHERE id = $1").bind(org).execute(&mut *tx).await?;
        }
    }
    if let Some(vol) = v.volonteer_id {
        sqlx::query("UPDATE volonteer_event_requests SET status = 'CANCELLED', rejection_reason = 'Волонтёр удалил учётную запись'
                      WHERE volonteer_id = $1 AND (status = 'OPEN' OR (status = 'ACCEPTED' AND event_id IN (SELECT id FROM events WHERE status = 'ACCEPTED')))")
            .bind(vol).execute(&mut *tx).await?;
        sqlx::query("DELETE FROM event_reviews WHERE volonteer_id = $1").bind(vol).execute(&mut *tx).await?;
        sqlx::query("UPDATE persons SET first_name = $2, last_name = $3, middle_name = NULL, birth_date = NULL WHERE id = (SELECT person_id FROM volonteers WHERE id = $1)")
            .bind(vol).bind(first).bind(last).execute(&mut *tx).await?;
        sqlx::query("UPDATE volonteers SET email = 'deleted-' || id::text || '@deleted.invalid', phone = '', student_id = NULL, faculty = NULL WHERE id = $1")
            .bind(vol).execute(&mut *tx).await?;
    }
    sqlx::query("UPDATE persons SET first_name = $2, last_name = $3, middle_name = NULL, birth_date = NULL WHERE id = $1")
        .bind(person_id).bind(first).bind(last).execute(&mut *tx).await?;
    sqlx::query("UPDATE map_markers SET contact_phone = NULL, created_by_name = $2 WHERE created_by = $1").bind(v.user_id).bind(&tombstone).execute(&mut *tx).await?;
    sqlx::query("UPDATE marker_closures SET submitted_by_name = $2 WHERE submitted_by = $1").bind(v.user_id).bind(&tombstone).execute(&mut *tx).await?;
    sqlx::query("UPDATE users SET email = 'deleted-' || id::text || '@deleted.invalid', password_hash = '!', token_version = token_version + 1,
                        failed_logins = 0, locked_until = NULL, deleted_at = now() WHERE id = $1").bind(v.user_id).execute(&mut *tx).await?;
    audit(&mut tx, Some(v), "account.delete", "user", Some(v.user_id), json!({})).await?;
    tx.commit().await?;
    set_cookie(ctx, auth::clear_cookie(st(ctx).cfg.cookie_secure));
    Ok(true)
}

#[allow(dead_code)]
fn _unused(_: ID) {}
