//! Модели: перечисления, строки БД и GraphQL-объекты.
//!
//! Наружу отдаются «плоские» производные поля (organizationName, requestsCount, ratingAvg …),
//! которые раньше считал фронтенд, — теперь их считает PostgreSQL.
use async_graphql::{ComplexObject, Context, Enum, SimpleObject, ID};
use chrono::{DateTime, Duration, NaiveDate, Utc};
use sqlx::FromRow;
use uuid::Uuid;

use crate::error::{AppError, AppResult};

// ---------- Перечисления (совпадают с типами PostgreSQL) -------------------------
macro_rules! pg_enum {
    ($name:ident, $pg:literal, { $($variant:ident),+ $(,)? }) => {
        #[derive(Enum, Copy, Clone, Eq, PartialEq, Debug, sqlx::Type, serde::Serialize, serde::Deserialize)]
        #[sqlx(type_name = $pg, rename_all = "SCREAMING_SNAKE_CASE")]
        pub enum $name { $($variant),+ }
    };
}
pg_enum!(UserRole, "user_role", { Admin, Organizer, Volunteer });
pg_enum!(EventStatus, "event_status", { Draft, Accepted, Cancelled, Closed });
pg_enum!(RequestStatus, "request_status", { Open, Accepted, Cancelled, Confirmed });
pg_enum!(MapMarkerType, "marker_type", { Regular, SearchRescue });
pg_enum!(MapMarkerStatus, "marker_status", { Active, PendingApproval, Found, Closed });
pg_enum!(Urgency, "urgency", { High, Medium, Low });

// ---------- Вспомогательное ---------------------------------------------------
/// Московское время (UTC+3 без перехода на летнее время с 2014 года).
pub fn msk(t: DateTime<Utc>) -> chrono::DateTime<Utc> { t + Duration::hours(3) }
pub fn msk_date(t: DateTime<Utc>) -> String { msk(t).format("%Y-%m-%d").to_string() }
pub fn rfc3339(t: DateTime<Utc>) -> String { t.to_rfc3339_opts(chrono::SecondsFormat::Secs, true) }
pub fn opt_date(d: Option<NaiveDate>) -> Option<String> { d.map(|d| d.format("%Y-%m-%d").to_string()) }
pub fn photo_url(id: Uuid) -> String { format!("/media/photos/{id}") }
pub fn gid(id: Uuid) -> ID { ID(id.to_string()) }

pub fn parse_id(id: &ID) -> AppResult<Uuid> {
    Uuid::parse_str(id.as_str()).map_err(|_| AppError::validation("Некорректный идентификатор"))
}

/// Календарная дата или момент времени → UTC. Для «чистой» даты: начало — 00:00 МСК, конец — 23:59:59 МСК.
pub fn parse_when(s: &str, end_of_day: bool) -> AppResult<DateTime<Utc>> {
    let s = s.trim();
    if let Ok(d) = NaiveDate::parse_from_str(s, "%Y-%m-%d") {
        let t = if end_of_day { d.and_hms_opt(23, 59, 59) } else { d.and_hms_opt(0, 0, 0) }
            .ok_or_else(|| AppError::validation("Некорректная дата"))?;
        return Ok(DateTime::<Utc>::from_naive_utc_and_offset(t, Utc) - Duration::hours(3));
    }
    DateTime::parse_from_rfc3339(s)
        .map(|t| t.with_timezone(&Utc))
        .map_err(|_| AppError::validation("Дата должна быть в формате ГГГГ-ММ-ДД или RFC 3339"))
}

// ---------- Пользователь -------------------------------------------------------
#[derive(SimpleObject, Clone, Debug)]
pub struct User {
    pub id: ID,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub role: UserRole,
    pub created_at: String,
    pub organization_id: Option<ID>,
    pub volonteer_id: Option<ID>,
    /// Когда пользователь дал согласие на обработку персональных данных (null — не давал).
    pub consent_accepted_at: Option<String>,
    /// Версия политики обработки ПДн, с которой пользователь согласился.
    pub consent_version: Option<String>,
}

#[derive(FromRow, Debug)]
pub struct UserRow {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub role: UserRole,
    pub created_at: DateTime<Utc>,
    pub organization_id: Option<Uuid>,
    pub volonteer_id: Option<Uuid>,
    pub consent_at: Option<DateTime<Utc>>,
    pub consent_version: Option<String>,
}
impl From<UserRow> for User {
    fn from(r: UserRow) -> Self {
        User {
            id: gid(r.id), first_name: r.first_name, last_name: r.last_name, email: r.email, role: r.role,
            created_at: rfc3339(r.created_at), organization_id: r.organization_id.map(gid), volonteer_id: r.volonteer_id.map(gid),
            consent_accepted_at: r.consent_at.map(rfc3339), consent_version: r.consent_version,
        }
    }
}
pub const USER_SELECT: &str = "SELECT u.id, p.first_name, p.last_name, u.email, u.role, u.created_at, u.organization_id, u.volonteer_id, u.consent_at, u.consent_version
    FROM users u JOIN persons p ON p.id = u.person_id";

#[derive(SimpleObject)]
pub struct AuthPayload {
    /// Токен возвращается только если клиент попросил его заголовком `X-Token-Response: 1`
    /// (не-браузерные клиенты). Браузер получает его в HttpOnly-cookie и до JS он не доходит.
    pub token: Option<String>,
    pub user: User,
    pub expires_at: String,
}

// ---------- Организация --------------------------------------------------------
#[derive(FromRow, Debug)]
pub struct OrganizationRow {
    pub id: Uuid,
    pub name: String,
    pub inn: Option<String>,
    pub contact_person: String,
    pub email: String,
    pub phone: String,
    pub description: Option<String>,
    pub created_at: DateTime<Utc>,
}
pub const ORG_SELECT: &str = "SELECT id, name, inn, contact_person, email, phone, description, created_at FROM organizations";

#[derive(SimpleObject, Clone, Debug)]
#[graphql(complex)]
pub struct Organization {
    pub id: ID,
    pub name: String,
    pub description: Option<String>,
    /// Контакты видны администратору и организатору этой организации.
    pub inn: Option<String>,
    pub contact_person: Option<String>,
    pub email: Option<String>,
    pub phone: Option<String>,
    pub created_at: String,
}
impl Organization {
    pub fn from_row(r: OrganizationRow, reveal: bool) -> Self {
        Organization {
            id: gid(r.id), name: r.name, description: r.description, created_at: rfc3339(r.created_at),
            inn: reveal.then_some(r.inn).flatten(),
            contact_person: reveal.then_some(r.contact_person),
            email: reveal.then_some(r.email),
            phone: reveal.then_some(r.phone),
        }
    }
}
#[ComplexObject]
impl Organization {
    async fn events(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<Event>> {
        Ok(crate::svc::events_of_org(ctx, parse_id(&self.id)?).await?)
    }
}

// ---------- Волонтёр -----------------------------------------------------------
#[derive(FromRow, Debug)]
pub struct VolonteerRow {
    pub id: Uuid,
    pub first_name: String,
    pub last_name: String,
    pub full_name: String,
    pub birth_date: Option<NaiveDate>,
    pub email: String,
    pub phone: String,
    pub student_id: Option<String>,
    pub faculty: Option<String>,
    pub total_hours: f64,
    pub created_at: DateTime<Utc>,
}
pub const VOL_SELECT: &str = "SELECT v.id, p.first_name, p.last_name,
        concat_ws(' ', p.last_name, p.first_name, p.middle_name) AS full_name,
        p.birth_date, v.email, v.phone, v.student_id, v.faculty, v.created_at,
        COALESCE((SELECT sum(r.confirmed_hours) FROM volonteer_event_requests r
                   WHERE r.volonteer_id = v.id AND r.status = 'CONFIRMED'), 0)::float8 AS total_hours
    FROM volonteers v JOIN persons p ON p.id = v.person_id";

#[derive(SimpleObject, Clone, Debug)]
#[graphql(complex)]
pub struct Volonteer {
    pub id: ID,
    pub full_name: String,
    pub first_name: String,
    pub last_name: String,
    /// Контакты и дата рождения — только сам волонтёр и администратор;
    /// email/телефон — ещё и организатор, у которого есть заявка этого волонтёра.
    pub email: Option<String>,
    pub phone: Option<String>,
    pub birth_date: Option<String>,
    pub student_id: Option<String>,
    pub faculty: Option<String>,
    pub total_confirmed_hours: f64,
    pub created_at: String,
}
#[derive(Copy, Clone, PartialEq, Eq)]
pub enum VolAccess { Public, Organizer, Full }

impl Volonteer {
    pub fn from_row(r: VolonteerRow, access: VolAccess) -> Self {
        let contacts = access != VolAccess::Public;
        let full = access == VolAccess::Full;
        Volonteer {
            id: gid(r.id), full_name: r.full_name, first_name: r.first_name, last_name: r.last_name,
            email: contacts.then_some(r.email), phone: contacts.then_some(r.phone),
            birth_date: if full { opt_date(r.birth_date) } else { None },
            student_id: contacts.then_some(r.student_id).flatten(), faculty: r.faculty,
            total_confirmed_hours: r.total_hours, created_at: rfc3339(r.created_at),
        }
    }
}
#[ComplexObject]
impl Volonteer {
    async fn requests(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<VolonteerEventRequest>> {
        Ok(crate::svc::requests_list(ctx, Some(parse_id(&self.id)?), None, None).await?)
    }
}

// ---------- Событие -------------------------------------------------------------
#[derive(FromRow, Debug)]
pub struct EventRow {
    pub id: Uuid,
    pub organization_id: Uuid,
    pub organization_name: String,
    pub title: String,
    pub description: String,
    pub location: String,
    pub start_at: DateTime<Utc>,
    pub end_at: DateTime<Utc>,
    pub required_volunteers: i32,
    pub planned_hours: f64,
    pub status: EventStatus,
    pub cancel_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub requests_count: i64,
    pub approved_count: i64,
    pub rating_avg: Option<f64>,
    pub reviews_count: i64,
}
pub const EVENT_SELECT: &str = "SELECT e.id, e.organization_id, o.name AS organization_name, e.title, e.description, e.location,
        e.start_at, e.end_at, e.required_volunteers, e.planned_hours::float8 AS planned_hours, e.status, e.cancel_reason, e.created_at,
        (SELECT count(*) FROM volonteer_event_requests r WHERE r.event_id = e.id) AS requests_count,
        (SELECT count(*) FROM volonteer_event_requests r WHERE r.event_id = e.id AND r.status IN ('ACCEPTED','CONFIRMED')) AS approved_count,
        (SELECT round(avg(v.rating)::numeric, 1)::float8 FROM event_reviews v WHERE v.event_id = e.id) AS rating_avg,
        (SELECT count(*) FROM event_reviews v WHERE v.event_id = e.id) AS reviews_count
    FROM events e JOIN organizations o ON o.id = e.organization_id";

#[derive(SimpleObject, Clone, Debug)]
#[graphql(complex)]
pub struct Event {
    pub id: ID,
    pub title: String,
    pub description: String,
    pub location: String,
    /// Дата начала по Москве, ГГГГ-ММ-ДД (совместимость с фронтом).
    pub start_date: String,
    pub end_date: String,
    /// Момент начала/окончания — Event.startDateTime / endDateTime из модели (RFC 3339, UTC).
    pub start_date_time: String,
    pub end_date_time: String,
    pub required_volunteers: i32,
    pub planned_hours: f64,
    pub status: EventStatus,
    /// Причина отмены (только у отменённых событий).
    pub cancel_reason: Option<String>,
    pub organization_id: ID,
    pub organization_name: String,
    pub requests_count: i64,
    pub approved_volunteers_count: i64,
    pub rating_avg: Option<f64>,
    pub reviews_count: i64,
    pub created_at: String,
}
impl From<EventRow> for Event {
    fn from(r: EventRow) -> Self {
        Event {
            id: gid(r.id), title: r.title, description: r.description, location: r.location,
            start_date: msk_date(r.start_at), end_date: msk_date(r.end_at),
            start_date_time: rfc3339(r.start_at), end_date_time: rfc3339(r.end_at),
            required_volunteers: r.required_volunteers, planned_hours: r.planned_hours, status: r.status, cancel_reason: r.cancel_reason,
            organization_id: gid(r.organization_id), organization_name: r.organization_name,
            requests_count: r.requests_count, approved_volunteers_count: r.approved_count,
            rating_avg: r.rating_avg, reviews_count: r.reviews_count, created_at: rfc3339(r.created_at),
        }
    }
}
#[ComplexObject]
impl Event {
    async fn organization(&self, ctx: &Context<'_>) -> async_graphql::Result<Organization> {
        Ok(crate::svc::organization_by_id(ctx, parse_id(&self.organization_id)?).await?)
    }
    async fn requests(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<VolonteerEventRequest>> {
        Ok(crate::svc::requests_list(ctx, None, Some(parse_id(&self.id)?), None).await?)
    }
    async fn reviews(&self, ctx: &Context<'_>) -> async_graphql::Result<Vec<EventReview>> {
        Ok(crate::svc::reviews_list(ctx, Some(parse_id(&self.id)?), None).await?)
    }
}

// ---------- Заявка (VolonteerEventRequest) ----------------------------------------
#[derive(FromRow, Debug)]
pub struct RequestRow {
    pub id: Uuid,
    pub volonteer_id: Uuid,
    pub volonteer_name: String,
    pub volonteer_faculty: Option<String>,
    pub volonteer_student_id: Option<String>,
    pub event_id: Uuid,
    pub event_title: String,
    pub event_start: DateTime<Utc>,
    pub event_status: EventStatus,
    pub organization_id: Uuid,
    pub organization_name: String,
    pub description: Option<String>,
    pub status: RequestStatus,
    pub requested_hours: f64,
    pub confirmed_hours: Option<f64>,
    pub rejection_reason: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}
pub const REQUEST_SELECT: &str = "SELECT r.id, r.volonteer_id, concat_ws(' ', p.last_name, p.first_name, p.middle_name) AS volonteer_name,
        v.faculty AS volonteer_faculty, v.student_id AS volonteer_student_id,
        r.event_id, e.title AS event_title, e.start_at AS event_start, e.status AS event_status,
        e.organization_id, o.name AS organization_name,
        r.description, r.status, r.requested_hours::float8 AS requested_hours, r.confirmed_hours::float8 AS confirmed_hours,
        r.rejection_reason, r.created_at, r.updated_at
    FROM volonteer_event_requests r
    JOIN volonteers v ON v.id = r.volonteer_id JOIN persons p ON p.id = v.person_id
    JOIN events e ON e.id = r.event_id JOIN organizations o ON o.id = e.organization_id";

#[derive(SimpleObject, Clone, Debug)]
#[graphql(complex)]
pub struct VolonteerEventRequest {
    pub id: ID,
    pub volonteer_id: ID,
    pub volonteer_name: String,
    pub volonteer_faculty: Option<String>,
    pub volonteer_student_id: Option<String>,
    pub event_id: ID,
    pub event_title: String,
    pub event_date: String,
    pub event_status: EventStatus,
    pub organization_name: String,
    pub description: Option<String>,
    pub status: RequestStatus,
    pub requested_hours: f64,
    pub confirmed_hours: Option<f64>,
    pub rejection_reason: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}
impl From<RequestRow> for VolonteerEventRequest {
    fn from(r: RequestRow) -> Self {
        VolonteerEventRequest {
            id: gid(r.id), volonteer_id: gid(r.volonteer_id), volonteer_name: r.volonteer_name,
            volonteer_faculty: r.volonteer_faculty, volonteer_student_id: r.volonteer_student_id,
            event_id: gid(r.event_id), event_title: r.event_title, event_date: msk_date(r.event_start),
            event_status: r.event_status, organization_name: r.organization_name, description: r.description,
            status: r.status, requested_hours: r.requested_hours, confirmed_hours: r.confirmed_hours,
            rejection_reason: r.rejection_reason, created_at: rfc3339(r.created_at), updated_at: rfc3339(r.updated_at),
        }
    }
}
#[ComplexObject]
impl VolonteerEventRequest {
    async fn volonteer(&self, ctx: &Context<'_>) -> async_graphql::Result<Volonteer> {
        Ok(crate::svc::volonteer_by_id(ctx, parse_id(&self.volonteer_id)?).await?)
    }
    async fn event(&self, ctx: &Context<'_>) -> async_graphql::Result<Event> {
        Ok(crate::svc::event_by_id(ctx, parse_id(&self.event_id)?).await?)
    }
}

// ---------- Отзыв -----------------------------------------------------------------
#[derive(FromRow, Debug)]
pub struct ReviewRow {
    pub id: Uuid,
    pub event_id: Uuid,
    pub volonteer_id: Uuid,
    pub author_name: String,
    pub rating: i16,
    pub text: String,
    pub created_at: DateTime<Utc>,
    pub updated_at: Option<DateTime<Utc>>,
}
pub const REVIEW_SELECT: &str = "SELECT id, event_id, volonteer_id, author_name, rating, text, created_at, updated_at FROM event_reviews";

#[derive(SimpleObject, Clone, Debug)]
#[graphql(complex)]
pub struct EventReview {
    pub id: ID,
    pub event_id: ID,
    pub volonteer_id: ID,
    pub author_name: String,
    pub rating: i32,
    pub text: String,
    pub created_at: String,
    pub updated_at: Option<String>,
}
impl From<ReviewRow> for EventReview {
    fn from(r: ReviewRow) -> Self {
        EventReview {
            id: gid(r.id), event_id: gid(r.event_id), volonteer_id: gid(r.volonteer_id), author_name: r.author_name,
            rating: r.rating as i32, text: r.text, created_at: rfc3339(r.created_at), updated_at: r.updated_at.map(rfc3339),
        }
    }
}
#[ComplexObject]
impl EventReview {
    async fn event(&self, ctx: &Context<'_>) -> async_graphql::Result<Event> {
        Ok(crate::svc::event_by_id(ctx, parse_id(&self.event_id)?).await?)
    }
    async fn volonteer(&self, ctx: &Context<'_>) -> async_graphql::Result<Volonteer> {
        Ok(crate::svc::volonteer_by_id(ctx, parse_id(&self.volonteer_id)?).await?)
    }
}

// ---------- Карта -------------------------------------------------------------------
#[derive(SimpleObject, Clone, Debug)]
pub struct ClosureProof {
    /// Ссылка на фото отчёта (отдаётся только авторизованным) либо пустая строка.
    pub photo: String,
    pub note: String,
    pub target_status: MapMarkerStatus,
    pub submitted_by: Option<ID>,
    pub submitted_by_name: String,
    pub submitted_at: String,
    pub approved_at: Option<String>,
    pub approved_by: Option<String>,
    pub rejected_at: Option<String>,
    pub reject_reason: Option<String>,
}

#[derive(SimpleObject, Clone, Debug)]
pub struct MapMarker {
    pub id: ID,
    #[graphql(name = "type")]
    pub kind: MapMarkerType,
    pub status: MapMarkerStatus,
    pub title: String,
    pub description: String,
    pub lat: f64,
    pub lng: f64,
    pub urgency: Urgency,
    pub contact_phone: Option<String>,
    pub last_seen_date: Option<String>,
    pub last_seen_location: Option<String>,
    /// Ссылки вида /media/photos/{id}; сами файлы лежат в PostgreSQL.
    pub photos: Vec<String>,
    pub closure_proof: Option<ClosureProof>,
    pub created_by: Option<ID>,
    pub created_by_name: String,
    pub created_at: String,
}

#[derive(FromRow, Debug)]
pub struct MarkerRow {
    pub id: Uuid,
    pub kind: MapMarkerType,
    pub status: MapMarkerStatus,
    pub title: String,
    pub description: String,
    pub lat: f64,
    pub lng: f64,
    pub urgency: Urgency,
    pub contact_phone: Option<String>,
    pub last_seen_date: Option<NaiveDate>,
    pub last_seen_location: Option<String>,
    pub created_by: Option<Uuid>,
    pub created_by_name: String,
    pub created_at: DateTime<Utc>,
}
pub const MARKER_SELECT: &str = "SELECT id, type AS kind, status, title, description, lat, lng, urgency, contact_phone,
        last_seen_date, last_seen_location, created_by, created_by_name, created_at FROM map_markers";

#[derive(FromRow, Debug)]
pub struct ClosureRow {
    pub marker_id: Uuid,
    pub photo_id: Option<Uuid>,
    pub note: String,
    pub target_status: MapMarkerStatus,
    pub submitted_by: Option<Uuid>,
    pub submitted_by_name: String,
    pub submitted_at: DateTime<Utc>,
    pub approved_at: Option<DateTime<Utc>>,
    pub approved_by: Option<String>,
    pub rejected_at: Option<DateTime<Utc>>,
    pub reject_reason: Option<String>,
}
impl From<ClosureRow> for ClosureProof {
    fn from(c: ClosureRow) -> Self {
        ClosureProof {
            photo: c.photo_id.map(photo_url).unwrap_or_default(), note: c.note, target_status: c.target_status,
            submitted_by: c.submitted_by.map(gid), submitted_by_name: c.submitted_by_name,
            submitted_at: rfc3339(c.submitted_at), approved_at: c.approved_at.map(rfc3339), approved_by: c.approved_by,
            rejected_at: c.rejected_at.map(rfc3339), reject_reason: c.reject_reason,
        }
    }
}

#[derive(async_graphql::InputObject)]
pub struct MapMarkerInput {
    #[graphql(name = "type")]
    pub kind: MapMarkerType,
    pub title: String,
    pub description: String,
    pub lat: f64,
    pub lng: f64,
    pub urgency: Urgency,
    pub contact_phone: Option<String>,
    pub last_seen_date: Option<String>,
    pub last_seen_location: Option<String>,
    /// До 5 изображений в виде data URL (JPEG/PNG/WebP). Сервер перекодирует их и удалит EXIF.
    pub photos: Option<Vec<String>>,
}

// ---------- Выписка --------------------------------------------------------------------
#[derive(SimpleObject, Clone, Debug)]
pub struct StatementReportItem {
    pub event_name: String,
    pub organization_name: String,
    pub event_date: String,
    pub location: String,
    pub confirmed_hours: f64,
}

#[derive(SimpleObject, Clone, Debug)]
pub struct StatementReport {
    pub volunteer: Volonteer,
    pub volonteer: Volonteer,
    pub start_date: String,
    pub end_date: String,
    pub generated_at: String,
    pub total_hours: f64,
    pub closed_events_count: i32,
    pub items: Vec<StatementReportItem>,
}

/// Состояние сессии для клиента.
#[derive(SimpleObject, Clone, Debug)]
pub struct Session {
    pub user: User,
    pub expires_at: String,
}
