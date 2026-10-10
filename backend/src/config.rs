//! Конфигурация из переменных окружения (см. backend/.env.example).
use anyhow::{bail, Context};
use rand::RngCore;

/// Секрет, который не попадает в логи через `Debug`.
#[derive(Clone)]
pub struct Secret(String);
impl Secret {
    pub fn expose(&self) -> &str { &self.0 }
}
impl std::fmt::Debug for Secret {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result { f.write_str("Secret(***)") }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum SmtpTls {
    /// Порт 587: соединение открывается без шифрования и переключается командой STARTTLS.
    StartTls,
    /// Порт 465: TLS с первого байта.
    Tls,
    /// Без шифрования — только для локального тестового сервера.
    None,
}

#[derive(Clone, Debug)]
pub struct Config {
    pub database_url: String,
    pub bind: String,
    pub production: bool,
    pub jwt_secret: Vec<u8>,
    pub session_hours: i64,
    pub cookie_secure: bool,
    pub allowed_origins: Vec<String>,
    pub static_dir: Option<String>,
    pub public_marker_photos: bool,
    pub trust_proxy: bool,
    pub max_body_bytes: usize,
    pub run_migrations: bool,
    /// Адрес, по которому пользователи открывают сайт; из него строятся ссылки в письмах.
    pub public_url: String,
    pub smtp_host: Option<String>,
    pub smtp_port: u16,
    pub smtp_user: Option<String>,
    pub smtp_password: Option<Secret>,
    pub smtp_from: Option<String>,
    pub smtp_tls: SmtpTls,
    /// Без подтверждённой почты нельзя создавать события, заявки и метки.
    pub require_verified_email: bool,
}

fn env(name: &str) -> Option<String> {
    std::env::var(name).ok().map(|v| v.trim().to_string()).filter(|v| !v.is_empty())
}
fn flag(name: &str, default: bool) -> bool {
    env(name).map(|v| matches!(v.to_lowercase().as_str(), "1" | "true" | "yes" | "on")).unwrap_or(default)
}

impl Config {
    pub fn from_env() -> anyhow::Result<Self> {
        let production = env("APP_ENV").map(|v| v == "production").unwrap_or(false);
        let database_url = env("DATABASE_URL").context("не задана переменная DATABASE_URL")?;

        let jwt_secret = match env("JWT_SECRET") {
            Some(s) => {
                if s.len() < 32 {
                    bail!("JWT_SECRET должен быть не короче 32 символов");
                }
                s.into_bytes()
            }
            None if production => bail!("В production обязательно задайте JWT_SECRET (≥ 32 символов)"),
            None => {
                tracing::warn!("JWT_SECRET не задан: сгенерирован одноразовый ключ, сессии сбросятся при перезапуске");
                let mut buf = [0u8; 48];
                rand::thread_rng().fill_bytes(&mut buf);
                hex::encode(buf).into_bytes()
            }
        };

        let allowed_origins = env("ALLOWED_ORIGINS")
            .map(|v| v.split(',').map(|s| s.trim().trim_end_matches('/').to_string()).filter(|s| !s.is_empty()).collect())
            .unwrap_or_else(|| {
                if production { Vec::new() } else {
                    vec!["http://localhost:3000".into(), "http://127.0.0.1:3000".into(), "http://localhost:5173".into(), "http://127.0.0.1:5173".into(), "http://localhost:8080".into(), "http://127.0.0.1:8080".into()]
                }
            });

        let smtp_host = env("SMTP_HOST");
        let smtp_tls = match env("SMTP_TLS").as_deref().map(str::to_lowercase).as_deref() {
            None | Some("starttls") => SmtpTls::StartTls,
            Some("tls") | Some("ssl") => SmtpTls::Tls,
            Some("none") => SmtpTls::None,
            Some(other) => bail!("SMTP_TLS: ожидается starttls, tls или none, получено «{other}»"),
        };
        if smtp_host.is_some() && env("SMTP_FROM").is_none() {
            bail!("Задан SMTP_HOST, но не задан SMTP_FROM (адрес отправителя)");
        }
        if production && smtp_tls == SmtpTls::None && smtp_host.is_some() {
            bail!("В production SMTP без шифрования (SMTP_TLS=none) запрещён");
        }
        let public_url = match env("PUBLIC_URL") {
            Some(u) => u.trim_end_matches('/').to_string(),
            None if smtp_host.is_some() && production => bail!("Для писем задайте PUBLIC_URL — адрес сайта, например https://volunteers.donstu.ru"),
            None => allowed_origins.first().cloned().unwrap_or_else(|| "http://localhost:5173".into()),
        };
        let require_verified_email = flag("REQUIRE_VERIFIED_EMAIL", false);
        if require_verified_email && smtp_host.is_none() {
            bail!("REQUIRE_VERIFIED_EMAIL=true требует настроенного SMTP (SMTP_HOST, SMTP_FROM)");
        }

        Ok(Config {
            database_url,
            bind: env("BIND").unwrap_or_else(|| "127.0.0.1:8080".into()),
            production,
            jwt_secret,
            session_hours: env("SESSION_HOURS").and_then(|v| v.parse().ok()).unwrap_or(24),
            cookie_secure: flag("COOKIE_SECURE", production),
            allowed_origins,
            static_dir: env("STATIC_DIR"),
            public_marker_photos: flag("PUBLIC_MARKER_PHOTOS", true),
            trust_proxy: flag("TRUST_PROXY", false),
            max_body_bytes: env("MAX_BODY_BYTES").and_then(|v| v.parse().ok()).unwrap_or(16 * 1024 * 1024),
            run_migrations: flag("RUN_MIGRATIONS", !production),
            public_url,
            smtp_host,
            smtp_port: env("SMTP_PORT").and_then(|v| v.parse().ok()).unwrap_or(match smtp_tls { SmtpTls::Tls => 465, _ => 587 }),
            smtp_user: env("SMTP_USER"),
            smtp_password: env("SMTP_PASSWORD").map(Secret),
            smtp_from: env("SMTP_FROM"),
            smtp_tls,
            require_verified_email,
        })
    }

    /// Конфигурация для тестов.
    pub fn for_tests(database_url: String) -> Self {
        Config {
            database_url,
            bind: "127.0.0.1:0".into(),
            production: false,
            jwt_secret: b"test-secret-test-secret-test-secret-1234".to_vec(),
            session_hours: 24,
            cookie_secure: false,
            allowed_origins: vec!["http://localhost:5173".into()],
            static_dir: None,
            public_marker_photos: true,
            trust_proxy: false,
            max_body_bytes: 16 * 1024 * 1024,
            run_migrations: true,
            public_url: "http://localhost:5173".into(),
            smtp_host: None,
            smtp_port: 587,
            smtp_user: None,
            smtp_password: None,
            smtp_from: None,
            smtp_tls: SmtpTls::StartTls,
            require_verified_email: false,
        }
    }
}
