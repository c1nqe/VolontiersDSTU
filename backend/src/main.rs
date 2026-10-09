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
        "serve" => {
            if cfg.run_migrations { MIGRATOR.run(&pool).await?; }
            let bind = cfg.bind.clone();
            let state = app::AppState { pool, cfg: Arc::new(cfg), limiter: Arc::new(RateLimiter::new()) };
            let router = app::router(state);
            let listener = tokio::net::TcpListener::bind(&bind).await.with_context(|| format!("не удалось занять {bind}"))?;
            tracing::info!("сервер запущен на http://{bind}");
            axum::serve(listener, router.into_make_service_with_connect_info::<SocketAddr>())
                .with_graceful_shutdown(async { let _ = tokio::signal::ctrl_c().await; })
                .await?;
        }
        other => anyhow::bail!("неизвестная команда «{other}». Доступно: serve | migrate | seed [--reset] | create-admin | schema"),
    }
    Ok(())
}
