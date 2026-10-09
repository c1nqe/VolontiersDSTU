//! Конфигурация из переменных окружения (см. backend/.env.example).
use anyhow::{bail, Context};
use rand::RngCore;

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
        }
    }
}
