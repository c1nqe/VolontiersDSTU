//! Демонстрационные данные (backend/seed/demo.json). Пароли хэшируются argon2id при загрузке.
use std::collections::HashMap;

use anyhow::{Context, Result};
use chrono::{DateTime, Duration, NaiveDate, NaiveDateTime, Utc};
use serde::Deserialize;
use sqlx::PgPool;
use uuid::Uuid;

use crate::{auth, media, model::parse_when};

const DEMO: &str = include_str!("../seed/demo.json");
const NS: Uuid = Uuid::from_u128(0x7a0c_e5d1_9b34_4f6a_8c21_0d5e_aa10_5eed);

fn id(key: &str) -> Uuid { Uuid::new_v5(&NS, key.as_bytes()) }

#[derive(Deserialize)] struct UserS { key: String, #[serde(rename = "firstName")] first: String, #[serde(rename = "lastName")] last: String, email: String, password: String, role: String, org: Option<String>, vol: Option<String>, #[serde(rename = "createdAt")] created_at: String }
#[derive(Deserialize)] struct OrgS { key: String, name: String, inn: Option<String>, #[serde(rename = "contactPerson")] contact: String, email: String, phone: String, description: Option<String> }
#[derive(Deserialize)] struct VolS { key: String, #[serde(rename = "fullName")] full_name: String, email: String, phone: String, #[serde(rename = "studentId")] student_id: Option<String>, faculty: Option<String>, #[serde(rename = "birthDate")] birth: Option<String> }
#[derive(Deserialize)] struct EvS { key: String, org: String, title: String, description: String, location: String, #[serde(rename = "startDate")] start: String, #[serde(rename = "endDate")] end: String, #[serde(rename = "requiredVolunteers")] required: i32, #[serde(rename = "plannedHours")] hours: f64, status: String, #[serde(rename = "ageDays")] age_days: i64 }
#[derive(Deserialize)] struct ReqS { key: String, vol: String, event: String, status: String, #[serde(rename = "requestedHours")] requested: f64, #[serde(rename = "confirmedHours")] confirmed: Option<f64>, #[serde(rename = "createdAt")] created_at: String }
#[derive(Deserialize)] struct RevS { event: String, vol: String, rating: i16, text: String, #[serde(rename = "createdAt")] created_at: String }
#[derive(Deserialize)] struct ClosS { note: String, #[serde(rename = "targetStatus")] target: String, #[serde(rename = "submittedBy")] by: Option<String>, #[serde(rename = "submittedByName")] by_name: String, #[serde(rename = "submittedAt")] at: String }
#[derive(Deserialize)] struct MarkS {
    key: String, #[serde(rename = "type")] kind: String, status: String, title: String, description: String, lat: f64, lng: f64, urgency: String,
    #[serde(rename = "contactPhone")] phone: Option<String>, #[serde(rename = "lastSeenDate")] seen_date: Option<String>, #[serde(rename = "lastSeenLocation")] seen_loc: Option<String>,
    #[serde(rename = "createdByVol")] by_vol: Option<String>, #[serde(rename = "createdByName")] by_name: String, #[serde(rename = "createdAt")] created_at: String,
    #[serde(rename = "demoPhotos")] demo_photos: u8, closure: Option<ClosS>,
}
#[derive(Deserialize)] struct Demo { users: Vec<UserS>, organizations: Vec<OrgS>, volonteers: Vec<VolS>, events: Vec<EvS>, requests: Vec<ReqS>, reviews: Vec<RevS>, markers: Vec<MarkS> }

fn ts(s: &str) -> Result<DateTime<Utc>> {
    if let Ok(t) = DateTime::parse_from_rfc3339(s) { return Ok(t.with_timezone(&Utc)); }
    if let Ok(t) = NaiveDateTime::parse_from_str(s, "%Y-%m-%dT%H:%M:%S") { return Ok(DateTime::from_naive_utc_and_offset(t, Utc)); }
    let d = NaiveDate::parse_from_str(s, "%Y-%m-%d")?;
    Ok(DateTime::from_naive_utc_and_offset(d.and_hms_opt(9, 0, 0).unwrap(), Utc))
}

pub async fn run(pool: &PgPool, reset: bool) -> Result<()> {
    let existing: i64 = sqlx::query_scalar("SELECT count(*) FROM users").fetch_one(pool).await?;
    if existing > 0 && !reset {
        tracing::info!("в БД уже есть данные — сид пропущен (используйте `seed --reset`, чтобы пересоздать демо-данные)");
        return Ok(());
    }
    let demo: Demo = serde_json::from_str(DEMO).context("seed/demo.json")?;
    let mut tx = pool.begin().await?;
    if reset {
        sqlx::query("TRUNCATE marker_closures, photos, map_markers, event_reviews, volonteer_event_requests, users, volonteers, events, organizations, persons RESTART IDENTITY CASCADE")
            .execute(&mut *tx).await?;
        sqlx::query("INSERT INTO audit_log (action, entity) VALUES ('seed.reset', 'database')").execute(&mut *tx).await?;
    }

    // организации
    for (i, o) in demo.organizations.iter().enumerate() {
        sqlx::query("INSERT INTO organizations (id, name, inn, contact_person, email, phone, description, created_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)")
            .bind(id(&o.key)).bind(&o.name).bind(&o.inn).bind(&o.contact).bind(&o.email).bind(&o.phone).bind(&o.description)
            .bind(Utc::now() - Duration::days(60 - i as i64)).execute(&mut *tx).await?;
    }
    // волонтёры (+ персоны)
    let mut person_of_vol: HashMap<String, Uuid> = HashMap::new();
    for v in &demo.volonteers {
        let mut it = v.full_name.split_whitespace();
        let (last, first) = (it.next().unwrap_or(""), it.next().unwrap_or(""));
        let middle = it.collect::<Vec<_>>().join(" ");
        let pid = Uuid::new_v5(&NS, format!("person:{}", v.key).as_bytes());
        let birth = v.birth.as_deref().map(|b| NaiveDate::parse_from_str(b, "%Y-%m-%d")).transpose()?;
        sqlx::query("INSERT INTO persons (id, first_name, last_name, middle_name, birth_date) VALUES ($1,$2,$3,$4,$5)")
            .bind(pid).bind(first).bind(last).bind(if middle.is_empty() { None } else { Some(middle) }).bind(birth).execute(&mut *tx).await?;
        sqlx::query("INSERT INTO volonteers (id, person_id, email, phone, student_id, faculty) VALUES ($1,$2,$3,$4,$5,$6)")
            .bind(id(&v.key)).bind(pid).bind(&v.email).bind(&v.phone).bind(&v.student_id).bind(&v.faculty).execute(&mut *tx).await?;
        person_of_vol.insert(v.key.clone(), pid);
    }
    // учётные записи
    for u in &demo.users {
        let pid = Uuid::new_v5(&NS, format!("person:{}", u.key).as_bytes());
        sqlx::query("INSERT INTO persons (id, first_name, last_name) VALUES ($1,$2,$3)").bind(pid).bind(&u.first).bind(&u.last).execute(&mut *tx).await?;
        let pw = u.password.clone();
        let hash = tokio::task::spawn_blocking(move || auth::hash_password(&pw)).await??;
        let role: &str = &u.role;
        sqlx::query("INSERT INTO users (id, person_id, email, password_hash, role, organization_id, volonteer_id, created_at) VALUES ($1,$2,$3,$4,$5::user_role,$6,$7,$8)")
            .bind(id(&u.key)).bind(pid).bind(&u.email).bind(hash).bind(role)
            .bind(u.org.as_deref().map(id)).bind(u.vol.as_deref().map(id)).bind(ts(&u.created_at)?).execute(&mut *tx).await?;
    }
    // события: создаём DRAFT, затем доводим до нужного статуса по правилам автомата
    for e in &demo.events {
        sqlx::query("INSERT INTO events (id, organization_id, title, description, location, start_at, end_at, required_volunteers, planned_hours, created_at)
                     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::float8::numeric(6,1),$10)")
            .bind(id(&e.key)).bind(id(&e.org)).bind(&e.title).bind(&e.description).bind(&e.location)
            .bind(parse_when(&e.start, false).map_err(|x| anyhow::anyhow!(x.message()))?).bind(parse_when(&e.end, true).map_err(|x| anyhow::anyhow!(x.message()))?)
            .bind(e.required).bind(e.hours).bind(Utc::now() - Duration::days(30) - Duration::hours(e.age_days)).execute(&mut *tx).await?;
        if e.status != "DRAFT" {
            let step = if e.status == "CANCELLED" { "CANCELLED" } else { "ACCEPTED" };
            sqlx::query("UPDATE events SET status = $2::event_status WHERE id = $1").bind(id(&e.key)).bind(step).execute(&mut *tx).await?;
        }
    }
    // заявки
    for r in &demo.requests {
        sqlx::query("INSERT INTO volonteer_event_requests (id, volonteer_id, event_id, requested_hours, created_at) VALUES ($1,$2,$3,$4::float8::numeric(6,1),$5)")
            .bind(id(&r.key)).bind(id(&r.vol)).bind(id(&r.event)).bind(r.requested).bind(ts(&r.created_at)?).execute(&mut *tx).await?;
        match r.status.as_str() {
            "ACCEPTED" | "CANCELLED" => { sqlx::query("UPDATE volonteer_event_requests SET status = $2::request_status WHERE id = $1").bind(id(&r.key)).bind(&r.status).execute(&mut *tx).await?; }
            "CONFIRMED" => {
                sqlx::query("UPDATE volonteer_event_requests SET status = 'ACCEPTED' WHERE id = $1").bind(id(&r.key)).execute(&mut *tx).await?;
                sqlx::query("UPDATE volonteer_event_requests SET status = 'CONFIRMED', confirmed_hours = $2::float8::numeric(6,1) WHERE id = $1")
                    .bind(id(&r.key)).bind(r.confirmed.unwrap_or(r.requested)).execute(&mut *tx).await?;
            }
            _ => {}
        }
    }
    // закрываем события, которые должны быть CLOSED
    for e in demo.events.iter().filter(|e| e.status == "CLOSED") {
        sqlx::query("UPDATE events SET status = 'CLOSED' WHERE id = $1").bind(id(&e.key)).execute(&mut *tx).await?;
    }
    // отзывы
    for r in &demo.reviews {
        let name: String = sqlx::query_scalar("SELECT concat_ws(' ', p.last_name, p.first_name, p.middle_name) FROM volonteers v JOIN persons p ON p.id = v.person_id WHERE v.id = $1")
            .bind(id(&r.vol)).fetch_one(&mut *tx).await?;
        sqlx::query("INSERT INTO event_reviews (event_id, volonteer_id, author_name, rating, text, created_at) VALUES ($1,$2,$3,$4,$5,$6)")
            .bind(id(&r.event)).bind(id(&r.vol)).bind(name).bind(r.rating).bind(&r.text).bind(ts(&r.created_at)?).execute(&mut *tx).await?;
    }
    // метки карты
    for (n, m) in demo.markers.iter().enumerate() {
        let creator = m.by_vol.as_deref().and_then(|v| demo.users.iter().find(|u| u.vol.as_deref() == Some(v))).map(|u| id(&u.key));
        let seen = m.seen_date.as_deref().map(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d")).transpose()?;
        sqlx::query("INSERT INTO map_markers (id, type, title, description, lat, lng, urgency, contact_phone, last_seen_date, last_seen_location, created_by, created_by_name, created_at)
                     VALUES ($1,$2::marker_type,$3,$4,$5,$6,$7::urgency,$8,$9,$10,$11,$12,$13)")
            .bind(id(&m.key)).bind(&m.kind).bind(&m.title).bind(&m.description).bind(m.lat).bind(m.lng).bind(&m.urgency)
            .bind(&m.phone).bind(seen).bind(&m.seen_loc).bind(creator).bind(&m.by_name).bind(ts(&m.created_at)?).execute(&mut *tx).await?;
        for p in 0..m.demo_photos {
            let bytes = media::placeholder(p + n as u8 * 3);
            let sha = hex::encode(<sha2::Sha256 as sha2::Digest>::digest(&bytes));
            sqlx::query("INSERT INTO photos (marker_id, purpose, position, content_type, data, size_bytes, sha256) VALUES ($1,'MARKER',$2,'image/jpeg',$3,$4,$5)")
                .bind(id(&m.key)).bind(p as i16).bind(&bytes).bind(bytes.len() as i32).bind(sha).execute(&mut *tx).await?;
        }
        if let Some(c) = &m.closure {
            let bytes = media::placeholder(200 + n as u8);
            let sha = hex::encode(<sha2::Sha256 as sha2::Digest>::digest(&bytes));
            let photo: Uuid = sqlx::query_scalar("INSERT INTO photos (marker_id, purpose, position, content_type, data, size_bytes, sha256) VALUES ($1,'CLOSURE',0,'image/jpeg',$2,$3,$4) RETURNING id")
                .bind(id(&m.key)).bind(&bytes).bind(bytes.len() as i32).bind(sha).fetch_one(&mut *tx).await?;
            sqlx::query("INSERT INTO marker_closures (marker_id, photo_id, note, target_status, submitted_by, submitted_by_name, submitted_at) VALUES ($1,$2,$3,$4::marker_status,$5,$6,$7)")
                .bind(id(&m.key)).bind(photo).bind(&c.note).bind(&c.target).bind(c.by.as_deref().and_then(|v| demo.users.iter().find(|u| u.vol.as_deref() == Some(v))).map(|u| id(&u.key)))
                .bind(&c.by_name).bind(ts(&c.at)?).execute(&mut *tx).await?;
        }
        // статус выставляем по автомату: ACTIVE → PENDING_APPROVAL / CLOSED, затем FOUND
        match m.status.as_str() {
            "PENDING_APPROVAL" => { sqlx::query("UPDATE map_markers SET status='PENDING_APPROVAL' WHERE id=$1").bind(id(&m.key)).execute(&mut *tx).await?; }
            "FOUND" => {
                sqlx::query("UPDATE map_markers SET status='PENDING_APPROVAL' WHERE id=$1").bind(id(&m.key)).execute(&mut *tx).await?;
                sqlx::query("UPDATE map_markers SET status='FOUND' WHERE id=$1").bind(id(&m.key)).execute(&mut *tx).await?;
            }
            "CLOSED" => { sqlx::query("UPDATE map_markers SET status='CLOSED' WHERE id=$1").bind(id(&m.key)).execute(&mut *tx).await?; }
            _ => {}
        }
    }
    sqlx::query("INSERT INTO audit_log (action, entity, details) VALUES ('seed.loaded', 'database', '{}')").execute(&mut *tx).await?;
    tx.commit().await?;
    tracing::info!("демо-данные загружены");
    Ok(())
}

/// Создаёт администратора (для production, где демо-сид запрещён).
pub async fn create_admin(pool: &PgPool, email: &str, last: &str, first: &str, password: &str) -> Result<()> {
    let email = email.trim().to_lowercase();
    auth::validate_password(password, &email).map_err(|e| anyhow::anyhow!(e.message()))?;
    let pw = password.to_string();
    let hash = tokio::task::spawn_blocking(move || auth::hash_password(&pw)).await??;
    let mut tx = pool.begin().await?;
    let pid: Uuid = sqlx::query_scalar("INSERT INTO persons (first_name, last_name) VALUES ($1,$2) RETURNING id").bind(first).bind(last).fetch_one(&mut *tx).await?;
    let uid: Uuid = sqlx::query_scalar("INSERT INTO users (person_id, email, password_hash, role) VALUES ($1,$2,$3,'ADMIN') RETURNING id")
        .bind(pid).bind(&email).bind(hash).fetch_one(&mut *tx).await.context("не удалось создать администратора (email занят?)")?;
    sqlx::query("INSERT INTO audit_log (actor_role, action, entity, entity_id) VALUES ('ADMIN', 'admin.created_via_cli', 'user', $1)").bind(uid).execute(&mut *tx).await?;
    tx.commit().await?;
    tracing::info!("администратор {email} создан");
    Ok(())
}
