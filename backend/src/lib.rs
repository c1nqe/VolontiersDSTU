#![allow(clippy::type_complexity, clippy::too_many_arguments)]
pub mod app;
pub mod auth;
pub mod config;
pub mod error;
pub mod graphql;
pub mod media;
pub mod model;
pub mod seed;
pub mod svc;

pub static MIGRATOR: sqlx::migrate::Migrator = sqlx::migrate!("./migrations");
