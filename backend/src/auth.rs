//! Аутентификация: argon2id, JWT (HS256) с отзывом через token_version,
//! роли и «зритель» (Viewer) — тот, кто выполняет запрос.
use std::{collections::HashMap, net::IpAddr, sync::Mutex, time::{Duration, Instant}};

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use jsonwebtoken::{decode, encode, Algorithm, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use uuid::Uuid;

use crate::{error::{AppError, AppResult}, model::UserRole};

pub const COOKIE_NAME: &str = "vt_session";

// ---------- Пароли -----------------------------------------------------------
pub fn hash_password(password: &str) -> anyhow::Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| anyhow::anyhow!("argon2: {e}"))
}

pub fn verify_password(password: &str, phc: &str) -> bool {
    match PasswordHash::new(phc) {
        Ok(parsed) => Argon2::default().verify_password(password.as_bytes(), &parsed).is_ok(),
        Err(_) => false,
    }
}

/// Хэш-приманка: на неизвестный email тоже тратится время argon2 (защита от перебора логинов по таймингу).
pub fn dummy_verify(password: &str) {
    static DUMMY: std::sync::OnceLock<String> = std::sync::OnceLock::new();
    let phc = DUMMY.get_or_init(|| hash_password("dummy-password-for-timing").unwrap_or_default());
    let _ = verify_password(password, phc);
}

const WEAK: &[&str] = &["password", "12345678", "123456789", "qwertyui", "qwerty123", "11111111", "password1", "йцукенгш"];

pub fn validate_password(password: &str, email: &str) -> AppResult<()> {
    let len = password.chars().count();
    if len < 8 {
        return Err(AppError::validation("Пароль должен содержать не менее 8 символов"));
    }
    if len > 128 {
        return Err(AppError::validation("Пароль не должен превышать 128 символов"));
    }
    let lower = password.to_lowercase();
    if WEAK.contains(&lower.as_str()) || lower == email.trim().to_lowercase() {
        return Err(AppError::validation("Пароль слишком простой — придумайте другой"));
    }
    if !password.chars().any(|c| c.is_alphabetic()) || !password.chars().any(|c| c.is_ascii_digit() || !c.is_alphanumeric()) {
        return Err(AppError::validation("Пароль должен содержать буквы и хотя бы одну цифру или спецсимвол"));
    }
    Ok(())
}

// ---------- JWT --------------------------------------------------------------
#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: Uuid,
    pub tv: i32,
    pub iat: i64,
    pub exp: i64,
}

pub fn issue_token(secret: &[u8], user_id: Uuid, token_version: i32, hours: i64) -> anyhow::Result<(String, i64)> {
    let now = chrono::Utc::now().timestamp();
    let claims = Claims { sub: user_id, tv: token_version, iat: now, exp: now + hours * 3600 };
    let token = encode(&Header::new(Algorithm::HS256), &claims, &EncodingKey::from_secret(secret))?;
    Ok((token, claims.exp))
}

pub fn decode_token(secret: &[u8], token: &str) -> Option<Claims> {
    let mut v = Validation::new(Algorithm::HS256);
    v.leeway = 5;
    v.set_required_spec_claims(&["exp", "sub"]);
    decode::<Claims>(token, &DecodingKey::from_secret(secret), &v).ok().map(|d| d.claims)
}

pub fn session_cookie(token: &str, max_age_secs: i64, secure: bool) -> String {
    format!(
        "{COOKIE_NAME}={token}; HttpOnly; SameSite=Lax; Path=/; Max-Age={max_age_secs}{}",
        if secure { "; Secure" } else { "" }
    )
}
pub fn clear_cookie(secure: bool) -> String {
    format!("{COOKIE_NAME}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0{}", if secure { "; Secure" } else { "" })
}

// ---------- Viewer -----------------------------------------------------------
/// Аутентифицированный пользователь, от имени которого выполняется запрос.
#[derive(Debug, Clone)]
pub struct Viewer {
    pub user_id: Uuid,
    pub role: UserRole,
    pub organization_id: Option<Uuid>,
    pub volonteer_id: Option<Uuid>,
    pub full_name: String,
    /// Момент истечения сессии (unix-время из JWT).
    pub exp: i64,
}

impl Viewer {
    pub fn is_admin(&self) -> bool { self.role == UserRole::Admin }

    /// Может ли действовать от имени организации (свой организатор или администратор).
    pub fn can_act_for_org(&self, org: Uuid) -> bool {
        self.is_admin() || (self.role == UserRole::Organizer && self.organization_id == Some(org))
    }
    /// Может ли действовать от имени волонтёра (сам волонтёр или администратор).
    pub fn can_act_for_volonteer(&self, vol: Uuid) -> bool {
        self.is_admin() || (self.role == UserRole::Volunteer && self.volonteer_id == Some(vol))
    }
}

/// Загружает пользователя по токену и сверяет token_version (отзыв сессий).
pub async fn viewer_from_token(pool: &PgPool, secret: &[u8], token: &str) -> Option<Viewer> {
    let claims = decode_token(secret, token)?;
    let row: Option<(Uuid, UserRole, Option<Uuid>, Option<Uuid>, String, String, i32)> = sqlx::query_as(
        "SELECT u.id, u.role, u.organization_id, u.volonteer_id, p.last_name, p.first_name, u.token_version
           FROM users u JOIN persons p ON p.id = u.person_id WHERE u.id = $1 AND u.deleted_at IS NULL",
    )
    .bind(claims.sub)
    .fetch_optional(pool)
    .await
    .ok()
    .flatten();
    let (id, role, org, vol, last, first, tv) = row?;
    if tv != claims.tv {
        return None;
    }
    Some(Viewer { user_id: id, role, organization_id: org, volonteer_id: vol, full_name: format!("{last} {first}"), exp: claims.exp })
}

// ---------- Ограничитель частоты (окно в памяти) ----------------------------
pub struct RateLimiter {
    hits: Mutex<HashMap<(IpAddr, &'static str), (u32, Instant)>>,
}

impl RateLimiter {
    pub fn new() -> Self { Self { hits: Mutex::new(HashMap::new()) } }

    /// true — запрос разрешён. limit запросов за window на (ip, ключ).
    pub fn allow(&self, ip: IpAddr, key: &'static str, limit: u32, window: Duration) -> bool {
        let mut map = self.hits.lock().unwrap_or_else(|e| e.into_inner());
        let now = Instant::now();
        if map.len() > 10_000 {
            map.retain(|_, (_, started)| now.duration_since(*started) < window);
        }
        let entry = map.entry((ip, key)).or_insert((0, now));
        if now.duration_since(entry.1) >= window {
            *entry = (0, now);
        }
        entry.0 += 1;
        entry.0 <= limit
    }
}

impl Default for RateLimiter { fn default() -> Self { Self::new() } }
