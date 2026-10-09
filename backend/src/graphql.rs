//! GraphQL-схема. Резолверы — тонкая обёртка над svc.rs.
use async_graphql::{Context, EmptySubscription, Object, Result, Schema, ID};

use crate::{model::*, svc};

pub type AppSchema = Schema<Query, Mutation, EmptySubscription>;

pub struct Query;

#[Object]
impl Query {
    /// Текущий пользователь (null для гостя).
    async fn me(&self, ctx: &Context<'_>) -> Result<Option<User>> { Ok(svc::me(ctx).await?) }
    /// Сессия: пользователь и срок действия.
    async fn session(&self, ctx: &Context<'_>) -> Result<Option<Session>> { Ok(svc::session(ctx).await?) }
    /// Список учётных записей — только администратор.
    async fn users(&self, ctx: &Context<'_>) -> Result<Vec<User>> { Ok(svc::users_list(ctx).await?) }

    async fn organizations(&self, ctx: &Context<'_>) -> Result<Vec<Organization>> { Ok(svc::organizations_list(ctx).await?) }
    async fn organization(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Organization>> {
        Ok(svc::organization_by_id(ctx, parse_id(&id)?).await.ok())
    }

    async fn volonteers(&self, ctx: &Context<'_>) -> Result<Vec<Volonteer>> { Ok(svc::volonteers_list(ctx).await?) }
    async fn volonteer(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Volonteer>> {
        Ok(svc::volonteer_by_id(ctx, parse_id(&id)?).await.ok())
    }

    async fn events(&self, ctx: &Context<'_>, status: Option<EventStatus>) -> Result<Vec<Event>> { Ok(svc::events_list(ctx, status).await?) }
    async fn event(&self, ctx: &Context<'_>, id: ID) -> Result<Option<Event>> { Ok(svc::event_by_id(ctx, parse_id(&id)?).await.ok()) }
    /// События, на которые можно подать заявку (ACCEPTED).
    async fn available_events(&self, ctx: &Context<'_>) -> Result<Vec<Event>> { Ok(svc::events_list(ctx, Some(EventStatus::Accepted)).await?) }

    async fn requests(&self, ctx: &Context<'_>, volonteer_id: Option<ID>, event_id: Option<ID>, status: Option<RequestStatus>) -> Result<Vec<VolonteerEventRequest>> {
        let vol = volonteer_id.as_ref().map(parse_id).transpose()?;
        let ev = event_id.as_ref().map(parse_id).transpose()?;
        Ok(svc::requests_list(ctx, vol, ev, status).await?)
    }
    async fn request(&self, ctx: &Context<'_>, id: ID) -> Result<Option<VolonteerEventRequest>> { Ok(svc::request_by_id(ctx, parse_id(&id)?).await?) }

    /// Выписка о подтверждённых часах (заявки CONFIRMED на событиях CLOSED) за период.
    async fn volonteer_statement(&self, ctx: &Context<'_>, volonteer_id: ID, start_date: String, end_date: String) -> Result<StatementReport> {
        Ok(svc::statement(ctx, parse_id(&volonteer_id)?, &start_date, &end_date).await?)
    }

    /// Отзывы: по событию и/или по волонтёру. Публично (автор — только ФИО).
    async fn reviews(&self, ctx: &Context<'_>, event_id: Option<ID>, volonteer_id: Option<ID>) -> Result<Vec<EventReview>> {
        let e = event_id.as_ref().map(parse_id).transpose()?;
        let v = volonteer_id.as_ref().map(parse_id).transpose()?;
        Ok(svc::reviews_list(ctx, e, v).await?)
    }
    async fn event_reviews(&self, ctx: &Context<'_>, event_id: ID) -> Result<Vec<EventReview>> {
        Ok(svc::reviews_list(ctx, Some(parse_id(&event_id)?), None).await?)
    }

    async fn map_markers(&self, ctx: &Context<'_>, #[graphql(name = "type")] kind: Option<MapMarkerType>) -> Result<Vec<MapMarker>> {
        Ok(svc::markers_list(ctx, kind).await?)
    }
}

pub struct Mutation;

#[Object]
impl Mutation {
    // ----- Аутентификация -----
    async fn register(&self, ctx: &Context<'_>, first_name: String, last_name: String, email: String, password: String, role: UserRole) -> Result<AuthPayload> {
        Ok(svc::register(ctx, &first_name, &last_name, &email, &password, role).await?)
    }
    async fn login(&self, ctx: &Context<'_>, email: String, password: String) -> Result<AuthPayload> {
        Ok(svc::login(ctx, &email, &password).await?)
    }
    /// Завершает все сессии пользователя (token_version++), очищает cookie.
    async fn logout(&self, ctx: &Context<'_>) -> Result<bool> { Ok(svc::logout(ctx).await?) }
    async fn change_password(&self, ctx: &Context<'_>, old_password: String, new_password: String) -> Result<bool> {
        Ok(svc::change_password(ctx, &old_password, &new_password).await?)
    }

    // ----- Администратор -----
    async fn register_organization(&self, ctx: &Context<'_>, name: String, contact_person: String, email: String, phone: String, inn: Option<String>, description: Option<String>) -> Result<Organization> {
        Ok(svc::register_organization(ctx, &name, &contact_person, &email, &phone, inn, description).await?)
    }
    async fn register_volonteer(&self, ctx: &Context<'_>, full_name: String, email: String, phone: String, student_id: Option<String>, faculty: Option<String>, birth_date: Option<String>) -> Result<Volonteer> {
        Ok(svc::register_volonteer(ctx, &full_name, &email, &phone, student_id, faculty, birth_date).await?)
    }
    /// DRAFT → ACCEPTED | CANCELLED
    async fn moderate_event(&self, ctx: &Context<'_>, event_id: ID, status: EventStatus) -> Result<Event> {
        Ok(svc::moderate_event(ctx, parse_id(&event_id)?, status).await?)
    }

    // ----- Организатор -----
    #[allow(clippy::too_many_arguments)]
    async fn create_event(&self, ctx: &Context<'_>, title: String, description: String, location: String, start_date: String, end_date: String, required_volunteers: i32, planned_hours: f64, organization_id: ID) -> Result<Event> {
        Ok(svc::create_event(ctx, &title, &description, &location, &start_date, &end_date, required_volunteers, planned_hours, parse_id(&organization_id)?).await?)
    }
    /// OPEN → ACCEPTED | CANCELLED
    async fn moderate_request(&self, ctx: &Context<'_>, request_id: ID, status: RequestStatus, rejection_reason: Option<String>) -> Result<VolonteerEventRequest> {
        Ok(svc::moderate_request(ctx, parse_id(&request_id)?, status, rejection_reason).await?)
    }
    /// ACCEPTED → CONFIRMED (часы проставляются атомарно)
    async fn confirm_volunteer_work(&self, ctx: &Context<'_>, request_id: ID, confirmed_hours: f64) -> Result<VolonteerEventRequest> {
        Ok(svc::confirm_work(ctx, parse_id(&request_id)?, confirmed_hours).await?)
    }
    /// ACCEPTED → CLOSED
    async fn close_event(&self, ctx: &Context<'_>, event_id: ID) -> Result<Event> { Ok(svc::close_event(ctx, parse_id(&event_id)?).await?) }

    // ----- Волонтёр -----
    async fn submit_event_request(&self, ctx: &Context<'_>, volonteer_id: ID, event_id: ID, description: Option<String>) -> Result<VolonteerEventRequest> {
        Ok(svc::submit_request(ctx, parse_id(&volonteer_id)?, parse_id(&event_id)?, description).await?)
    }
    /// OPEN → CANCELLED
    async fn cancel_event_request(&self, ctx: &Context<'_>, request_id: ID) -> Result<VolonteerEventRequest> {
        Ok(svc::cancel_request(ctx, parse_id(&request_id)?).await?)
    }
    async fn submit_event_review(&self, ctx: &Context<'_>, event_id: ID, volonteer_id: ID, rating: i32, text: String) -> Result<EventReview> {
        Ok(svc::submit_review(ctx, parse_id(&event_id)?, parse_id(&volonteer_id)?, rating, &text).await?)
    }
    async fn delete_event_review(&self, ctx: &Context<'_>, review_id: ID) -> Result<bool> { Ok(svc::delete_review(ctx, parse_id(&review_id)?).await?) }

    // ----- Карта -----
    async fn create_map_marker(&self, ctx: &Context<'_>, input: MapMarkerInput) -> Result<MapMarker> { Ok(svc::create_marker(ctx, input).await?) }
    /// ACTIVE → PENDING_APPROVAL: отчёт с фото о завершении ПСО.
    async fn request_marker_close(&self, ctx: &Context<'_>, marker_id: ID, photo: Option<String>, note: String, target_status: MapMarkerStatus) -> Result<MapMarker> {
        Ok(svc::request_marker_close(ctx, parse_id(&marker_id)?, photo, &note, target_status).await?)
    }
    async fn approve_marker_close(&self, ctx: &Context<'_>, marker_id: ID) -> Result<MapMarker> { Ok(svc::approve_marker_close(ctx, parse_id(&marker_id)?).await?) }
    async fn reject_marker_close(&self, ctx: &Context<'_>, marker_id: ID, reason: Option<String>) -> Result<MapMarker> {
        Ok(svc::reject_marker_close(ctx, parse_id(&marker_id)?, reason).await?)
    }
    /// Закрытие обычной метки (автор или администратор).
    async fn close_map_marker(&self, ctx: &Context<'_>, marker_id: ID) -> Result<MapMarker> { Ok(svc::close_marker(ctx, parse_id(&marker_id)?).await?) }
    async fn delete_map_marker(&self, ctx: &Context<'_>, marker_id: ID) -> Result<bool> { Ok(svc::delete_marker(ctx, parse_id(&marker_id)?).await?) }
}

/// Лимиты на запрос: глубина, сложность, интроспекция только вне production.
pub fn build_schema(state: crate::app::AppState) -> AppSchema {
    let production = state.cfg.production;
    let mut b = Schema::build(Query, Mutation, EmptySubscription)
        .data(state)
        .limit_depth(8)
        .limit_complexity(600);
    if production {
        b = b.disable_introspection();
    }
    b.finish()
}

/// SDL-контракт API (используется командой `schema` и тестом на «дрейф» schema.graphql).
pub fn sdl() -> String {
    Schema::build(Query, Mutation, EmptySubscription).finish().sdl()
}
