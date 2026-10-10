use std::{net::SocketAddr, sync::Arc};

use anyhow::Context;
use sqlx::postgres::PgPoolOptions;
use tracing_subscriber::EnvFilter;
use volontiers_server::{app, auth::RateLimiter, config::Config, seed, MIGRATOR};

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info,sqlx=warn")))
        .init();

    let cmd = std::env::args().nth(1).unwrap_or_else(|| "serve".into());
    if cmd == "schema" {
        print!("{}", volontiers_server::graphql::sdl());
        return Ok(());
    }
    let cfg = Config::from_env()?;
    let pool = PgPoolOptions::new().max_connections(10).acquire_timeout(std::time::Duration::from_secs(5))
        .connect(&cfg.database_url).await.context("не удалось подключиться к PostgreSQL")?;

    match cmd.as_str() {
        "migrate" => { MIGRATOR.run(&pool).await?; tracing::info!("миграции применены"); }
        "seed" => {
            if cfg.production {
                anyhow::bail!("seed загружает демо-учётки с простыми паролями и запрещён при APP_ENV=production. Создайте администратора командой create-admin");
            }
            MIGRATOR.run(&pool).await?;
            let reset = std::env::args().any(|a| a == "--reset");
            seed::run(&pool, reset).await?;
        }
        "create-admin" => {
            // volontiers-server create-admin <email> <Фамилия> <Имя>; пароль — из переменной ADMIN_PASSWORD
            let args: Vec<String> = std::env::args().skip(2).collect();
            let [email, last, first] = args.as_slice() else { anyhow::bail!("использование: create-admin <email> <Фамилия> <Имя> (пароль в ADMIN_PASSWORD)") };
            let password = std::env::var("ADMIN_PASSWORD").context("задайте ADMIN_PASSWORD")?;
            seed::create_admin(&pool, email, last, first, &password).await?;
        }
        "purge-audit" => {
            // Срок хранения журнала аудита (политика: 3 года). Выполняется владельцем таблицы (DATABASE_URL роли volontiers_owner):
            // рабочая роль сервера удалять записи журнала не может.
            let days: i64 = std::env::args().nth(2).and_then(|d| d.parse().ok()).context("использование: purge-audit <дней хранения, не менее 365>")?;
            anyhow::ensure!(days >= 365, "срок хранения журнала аудита не может быть меньше 365 дней");
            let mut tx = pool.begin().await?;
            sqlx::query("ALTER TABLE audit_log DISABLE TRIGGER audit_no_update").execute(&mut *tx).await.context("нужны права владельца таблицы audit_log")?;
            let n = sqlx::query("DELETE FROM audit_log WHERE at < now() - make_interval(days => $1::int)").bind(days as i32).execute(&mut *tx).await?.rows_affected();
            sqlx::query("ALTER TABLE audit_log ENABLE TRIGGER audit_no_update").execute(&mut *tx).await?;
            sqlx::query("INSERT INTO audit_log (action, entity, details) VALUES ('audit.purged', 'audit_log', $1)").bind(serde_json::json!({"olderThanDays": days, "deleted": n})).execute(&mut *tx).await?;
            tx.commit().await?;
            tracing::info!("удалено записей журнала аудита старше {days} дн.: {n}");
        }
        "serve" => {
            if cfg.run_migrations { MIGRATOR.run(&pool).await?; }
            let bind = cfg.bind.clone();
            let mailer = Arc::new(volontiers_server::mail::Mailer::from_config(&cfg)?);
            if !mailer.enabled() { tracing::warn!("SMTP не настроен: восстановление пароля и подтверждение почты недоступны"); }
            let state = app::AppState { pool, cfg: Arc::new(cfg), limiter: Arc::new(RateLimiter::new()), mailer };
            let router = app::router(state);
            let listener = tokio::net::TcpListener::bind(&bind).await.with_context(|| format!("не удалось занять {bind}"))?;
            tracing::info!("сервер запущен на http://{bind}");
            axum::serve(listener, router.into_make_service_with_connect_info::<SocketAddr>())
                .with_graceful_shutdown(async { let _ = tokio::signal::ctrl_c().await; })
                .await?;
        }
        other => anyhow::bail!("неизвестная команда «{other}». Доступно: serve | migrate | seed [--reset] | create-admin | purge-audit <дней> | schema"),
    }
    Ok(())
}
