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
    /// Версия действующей политики обработки персональных данных.
    async fn privacy_policy_version(&self) -> &'static str { svc::PRIVACY_POLICY_VERSION }
    /// Настроена ли отправка писем (восстановление пароля, подтверждение почты).
    async fn mail_enabled(&self, ctx: &Context<'_>) -> bool { crate::svc::st(ctx).mailer.enabled() }
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

    /// Фото меток, ожидающие проверки (только администратор).
    async fn photo_moderation_queue(&self, ctx: &Context<'_>) -> Result<Vec<PhotoModerationItem>> { Ok(svc::photo_moderation_queue(ctx).await?) }

    async fn map_markers(&self, ctx: &Context<'_>, #[graphql(name = "type")] kind: Option<MapMarkerType>) -> Result<Vec<MapMarker>> {
        Ok(svc::markers_list(ctx, kind).await?)
    }
}

pub struct Mutation;

#[Object]
impl Mutation {
    // ----- Аутентификация -----
    /// Регистрация волонтёра или организатора. `consent` — согласие на обработку персональных данных (обязательно).
    /// Для организатора можно указать название организации.
    #[allow(clippy::too_many_arguments)]
    async fn register(&self, ctx: &Context<'_>, first_name: String, last_name: String, email: String, password: String, role: UserRole, consent: bool, organization_name: Option<String>) -> Result<AuthPayload> {
        Ok(svc::register(ctx, &first_name, &last_name, &email, &password, role, consent, organization_name).await?)
    }
    async fn login(&self, ctx: &Context<'_>, email: String, password: String) -> Result<AuthPayload> {
        Ok(svc::login(ctx, &email, &password).await?)
    }
    /// Завершает все сессии пользователя (token_version++), очищает cookie.
    async fn logout(&self, ctx: &Context<'_>) -> Result<bool> { Ok(svc::logout(ctx).await?) }
    /// Письмо со ссылкой для нового пароля. Ответ всегда одинаков — по нему нельзя узнать, зарегистрирован ли адрес.
    async fn request_password_reset(&self, ctx: &Context<'_>, email: String) -> Result<bool> { Ok(svc::request_password_reset(ctx, &email).await?) }
    /// Новый пароль по токену из письма (токен одноразовый, живёт 1 час). Все прежние сессии отзываются.
    async fn reset_password(&self, ctx: &Context<'_>, token: String, new_password: String) -> Result<bool> {
        Ok(svc::reset_password(ctx, &token, &new_password).await?)
    }
    /// Подтверждение электронной почты по токену из письма.
    async fn verify_email(&self, ctx: &Context<'_>, token: String) -> Result<bool> { Ok(svc::verify_email(ctx, &token).await?) }
    /// Повторно отправить письмо для подтверждения почты (не чаще раза в минуту).
    async fn resend_verification(&self, ctx: &Context<'_>) -> Result<bool> { Ok(svc::resend_verification(ctx).await?) }
    async fn change_password(&self, ctx: &Context<'_>, old_password: String, new_password: String) -> Result<bool> {
        Ok(svc::change_password(ctx, &old_password, &new_password).await?)
    }

    /// Волонтёр правит свой профиль; передаются только изменяемые поля (пустая строка очищает факультет и номер билета).
    async fn update_my_profile(&self, ctx: &Context<'_>, first_name: Option<String>, last_name: Option<String>, phone: Option<String>, faculty: Option<String>, student_id: Option<String>) -> Result<Volonteer> {
        Ok(svc::update_my_profile(ctx, first_name, last_name, phone, faculty, student_id).await?)
    }
    /// Все данные пользователя о нём самом в виде JSON (право на доступ к данным, 152-ФЗ).
    async fn export_my_data(&self, ctx: &Context<'_>) -> Result<String> { Ok(svc::export_my_data(ctx).await?) }
    /// Удаление учётной записи с немедленным обезличиванием персональных данных. Требует пароль.
    async fn delete_my_account(&self, ctx: &Context<'_>, password: String) -> Result<bool> { Ok(svc::delete_my_account(ctx, &password).await?) }

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
    /// OPEN → ACCEPTED | CANCELLED; ACCEPTED → CANCELLED (отзыв принятой заявки)
    async fn moderate_request(&self, ctx: &Context<'_>, request_id: ID, status: RequestStatus, rejection_reason: Option<String>) -> Result<VolonteerEventRequest> {
        Ok(svc::moderate_request(ctx, parse_id(&request_id)?, status, rejection_reason).await?)
    }
    /// ACCEPTED → CONFIRMED (часы проставляются атомарно)
    async fn confirm_volunteer_work(&self, ctx: &Context<'_>, request_id: ID, confirmed_hours: f64) -> Result<VolonteerEventRequest> {
        Ok(svc::confirm_work(ctx, parse_id(&request_id)?, confirmed_hours).await?)
    }
    /// DRAFT | ACCEPTED → CANCELLED. Заявки принятого события отменяются автоматически.
    async fn cancel_event(&self, ctx: &Context<'_>, event_id: ID, reason: Option<String>) -> Result<Event> {
        Ok(svc::cancel_event(ctx, parse_id(&event_id)?, reason).await?)
    }
    /// ACCEPTED → CLOSED
    async fn close_event(&self, ctx: &Context<'_>, event_id: ID) -> Result<Event> { Ok(svc::close_event(ctx, parse_id(&event_id)?).await?) }

    // ----- Волонтёр -----
    async fn submit_event_request(&self, ctx: &Context<'_>, volonteer_id: ID, event_id: ID, description: Option<String>) -> Result<VolonteerEventRequest> {
        Ok(svc::submit_request(ctx, parse_id(&volonteer_id)?, parse_id(&event_id)?, description).await?)
    }
    /// OPEN | ACCEPTED → CANCELLED (волонтёр отказывается от участия)
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
    /// Администратор одобряет фото метки: оно становится видно всем.
    async fn approve_photo(&self, ctx: &Context<'_>, photo_id: ID) -> Result<MapMarker> { Ok(svc::approve_photo(ctx, parse_id(&photo_id)?).await?) }
    /// Администратор отклоняет фото метки: оно удаляется.
    async fn reject_photo(&self, ctx: &Context<'_>, photo_id: ID, reason: Option<String>) -> Result<MapMarker> {
        Ok(svc::reject_photo(ctx, parse_id(&photo_id)?, reason).await?)
    }
    async fn approve_marker_close(&self, ctx: &Context<'_>, marker_id: ID) -> Result<MapMarker> { Ok(svc::approve_marker_close(ctx, parse_id(&marker_id)?).await?) }
    async fn reject_marker_close(&self, ctx: &Context<'_>, marker_id: ID, reason: Option<String>) -> Result<MapMarker> {
        Ok(svc::reject_marker_close(ctx, parse_id(&marker_id)?, reason).await?)
    }
    /// Закрытие метки (автор или администратор). Закрытая метка ПСО удаляется сразу.
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
