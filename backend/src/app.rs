//! HTTP-слой: маршруты, cookie-сессия, CSRF-проверка Origin, заголовки безопасности, раздача фронтенда.
use std::{net::{IpAddr, SocketAddr}, sync::Arc};

use async_graphql::Request;
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    extract::{ConnectInfo, Path, State},
    http::{header, HeaderMap, HeaderName, HeaderValue, Method, StatusCode},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use sqlx::PgPool;
use tower_http::{limit::RequestBodyLimitLayer, services::{ServeDir, ServeFile}, set_header::SetResponseHeaderLayer, trace::TraceLayer};
use uuid::Uuid;

use crate::{
    auth::{self, RateLimiter, Viewer, COOKIE_NAME},
    config::Config,
    graphql::{build_schema, AppSchema},
    model::UserRole,
    svc::{ClientInfo, CookieOut},
};

#[derive(Clone)]
pub struct AppState {
    pub pool: PgPool,
    pub cfg: Arc<Config>,
    pub limiter: Arc<RateLimiter>,
}

#[derive(Clone)]
struct Web {
    state: AppState,
    schema: AppSchema,
}

fn cookie_value(headers: &HeaderMap, name: &str) -> Option<String> {
    let raw = headers.get(header::COOKIE)?.to_str().ok()?;
    raw.split(';').filter_map(|p| p.trim().split_once('=')).find(|(k, _)| *k == name).map(|(_, v)| v.to_string())
}

fn bearer(headers: &HeaderMap) -> Option<String> {
    let h = headers.get(header::AUTHORIZATION)?.to_str().ok()?;
    h.strip_prefix("Bearer ").map(|t| t.trim().to_string())
}

fn client_ip(cfg: &Config, headers: &HeaderMap, peer: SocketAddr) -> IpAddr {
    if cfg.trust_proxy {
        if let Some(ip) = headers.get("x-forwarded-for").and_then(|v| v.to_str().ok()).and_then(|v| v.split(',').next()).and_then(|v| v.trim().parse().ok()) {
            return ip;
        }
    }
    peer.ip()
}

async fn viewer_of(state: &AppState, headers: &HeaderMap) -> Option<Viewer> {
    let token = bearer(headers).or_else(|| cookie_value(headers, COOKIE_NAME))?;
    auth::viewer_from_token(&state.pool, &state.cfg.jwt_secret, &token).await
}

/// Защита от CSRF: запрос с чужим Origin отклоняется. Запросы без Origin (curl, серверные клиенты)
/// не используют cookie браузера, поэтому для них проверка не нужна.
fn origin_allowed(cfg: &Config, headers: &HeaderMap) -> bool {
    let Some(origin) = headers.get(header::ORIGIN).and_then(|v| v.to_str().ok()) else { return true };
    let origin = origin.trim_end_matches('/');
    if cfg.allowed_origins.iter().any(|o| o == origin) { return true; }
    // тот же хост, с которого отдан сам фронтенд (раздача через STATIC_DIR)
    if let Some(host) = headers.get(header::HOST).and_then(|v| v.to_str().ok()) {
        if origin == format!("http://{host}") || origin == format!("https://{host}") {
            return !cfg.production || origin.starts_with("https://");
        }
    }
    false
}

async fn graphql_handler(State(web): State<Web>, ConnectInfo(peer): ConnectInfo<SocketAddr>, headers: HeaderMap, req: GraphQLRequest) -> Response {
    if !origin_allowed(&web.state.cfg, &headers) {
        return (StatusCode::FORBIDDEN, "Запрос с недопустимым Origin").into_response();
    }
    let mut request: Request = req.into_inner();
    let cookie_out = CookieOut::default();
    let info = ClientInfo {
        ip: client_ip(&web.state.cfg, &headers, peer),
        want_token: headers.get("x-token-response").and_then(|v| v.to_str().ok()) == Some("1"),
    };
    request = request.data(info).data(cookie_out.clone());
    if let Some(v) = viewer_of(&web.state, &headers).await {
        request = request.data(v);
    }
    let response = web.schema.execute(request).await;
    let mut out = GraphQLResponse::from(response).into_response();
    if let Some(c) = cookie_out.0.lock().unwrap_or_else(|e| e.into_inner()).take() {
        if let Ok(v) = HeaderValue::from_str(&c) {
            out.headers_mut().append(header::SET_COOKIE, v);
        }
    }
    out.headers_mut().insert(header::CACHE_CONTROL, HeaderValue::from_static("no-store"));
    out
}

/// Фото отдаются только через сервер и только с проверкой прав.
async fn media_photo(State(web): State<Web>, headers: HeaderMap, Path(id): Path<Uuid>) -> Response {
    let row: Option<(String, String, Vec<u8>, String)> = match sqlx::query_as(
        "SELECT purpose::text, content_type, data, sha256 FROM photos WHERE id = $1",
    ).bind(id).fetch_optional(&web.state.pool).await {
        Ok(r) => r,
        Err(e) => { tracing::error!(error = ?e, "media"); return StatusCode::INTERNAL_SERVER_ERROR.into_response(); }
    };
    let Some((purpose, ctype, data, sha)) = row else { return StatusCode::NOT_FOUND.into_response() };
    let viewer = viewer_of(&web.state, &headers).await;
    let allowed = match purpose.as_str() {
        "MARKER" => viewer.is_some() || web.state.cfg.public_marker_photos,
        _ => viewer.is_some(),
    };
    if !allowed {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    let etag = format!("\"{sha}\"");
    if headers.get(header::IF_NONE_MATCH).and_then(|v| v.to_str().ok()) == Some(etag.as_str()) {
        return (StatusCode::NOT_MODIFIED, [(header::ETAG, etag)]).into_response();
    }
    let cache = if purpose == "MARKER" && web.state.cfg.public_marker_photos { "public, max-age=3600" } else { "private, max-age=600" };
    (
        [
            (header::CONTENT_TYPE, ctype),
            (header::ETAG, etag),
            (header::CACHE_CONTROL, cache.to_string()),
            (header::CONTENT_DISPOSITION, "inline".to_string()),
            (header::CONTENT_SECURITY_POLICY, "default-src 'none'; sandbox".to_string()),
            (HeaderName::from_static("cross-origin-resource-policy"), "same-site".to_string()),
        ],
        data,
    ).into_response()
}

async fn health(State(web): State<Web>) -> Response {
    match sqlx::query_scalar::<_, i32>("SELECT 1").fetch_one(&web.state.pool).await {
        Ok(_) => (StatusCode::OK, "ok").into_response(),
        Err(_) => (StatusCode::SERVICE_UNAVAILABLE, "db unavailable").into_response(),
    }
}


pub fn router(state: AppState) -> Router {
    let schema = build_schema(state.clone());
    let web = Web { state: state.clone(), schema };
    let cfg = state.cfg.clone();

    let mut app = Router::new()
        .route("/graphql", post(graphql_handler))
        .route("/media/photos/{id}", get(media_photo))
        .route("/healthz", get(health))
        .with_state(web);

    if let Some(dir) = &cfg.static_dir {
        let index = format!("{dir}/index.html");
        app = app.fallback_service(ServeDir::new(dir).not_found_service(ServeFile::new(index)));
    }

    let hdr = |name: &'static str, value: &'static str| SetResponseHeaderLayer::if_not_present(HeaderName::from_static(name), HeaderValue::from_static(value));
    app.layer(RequestBodyLimitLayer::new(cfg.max_body_bytes))
        .layer(hdr("x-content-type-options", "nosniff"))
        .layer(hdr("x-frame-options", "DENY"))
        .layer(hdr("referrer-policy", "same-origin"))
        .layer(hdr("permissions-policy", "camera=(), microphone=(), geolocation=()"))
        .layer(hdr("content-security-policy",
            "default-src 'self'; img-src 'self' data: blob: https://*.tile.openstreetmap.org https://*.basemaps.cartocdn.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; script-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"))
        .layer(TraceLayer::new_for_http())
}

#[allow(dead_code)]
fn _role(_: UserRole, _: Method) {}
