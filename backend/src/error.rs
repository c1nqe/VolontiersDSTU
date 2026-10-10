//! Ошибки приложения. Наружу (в GraphQL) уходит только безопасный текст и код;
//! детали внутренних ошибок пишутся в лог и клиенту не показываются.
use async_graphql::ErrorExtensions;

/// Намеренно без `Display`: иначе async-graphql применит общий `From<T: Display>` и потеряет код ошибки.
#[derive(Debug)]
pub enum AppError {
    Unauthenticated,
    Forbidden,
    /// Действие требует подтверждённой электронной почты.
    EmailNotVerified,
    NotFound(String),
    Validation(String),
    Conflict(String),
    TooManyRequests(String),
    Internal(anyhow::Error),
}

impl From<anyhow::Error> for AppError {
    fn from(e: anyhow::Error) -> Self { AppError::Internal(e) }
}

impl AppError {
    pub fn code(&self) -> &'static str {
        match self {
            AppError::Unauthenticated => "UNAUTHENTICATED",
            AppError::Forbidden => "FORBIDDEN",
            AppError::EmailNotVerified => "EMAIL_NOT_VERIFIED",
            AppError::NotFound(_) => "NOT_FOUND",
            AppError::Validation(_) => "BAD_USER_INPUT",
            AppError::Conflict(_) => "CONFLICT",
            AppError::TooManyRequests(_) => "TOO_MANY_REQUESTS",
            AppError::Internal(_) => "INTERNAL",
        }
    }
    /// Безопасный для показа пользователю текст.
    pub fn message(&self) -> String {
        match self {
            AppError::Unauthenticated => "Требуется вход в систему".into(),
            AppError::Forbidden => "Недостаточно прав для этого действия".into(),
            AppError::EmailNotVerified => "Подтвердите адрес электронной почты: ссылка отправлена в письме при регистрации. Отправить письмо ещё раз можно в личном кабинете.".into(),
            AppError::NotFound(m) | AppError::Validation(m) | AppError::Conflict(m) | AppError::TooManyRequests(m) => m.clone(),
            AppError::Internal(_) => "Внутренняя ошибка сервера. Повторите попытку позже.".into(),
        }
    }
    pub fn validation(msg: impl Into<String>) -> Self { AppError::Validation(msg.into()) }
    pub fn not_found(msg: impl Into<String>) -> Self { AppError::NotFound(msg.into()) }
    pub fn conflict(msg: impl Into<String>) -> Self { AppError::Conflict(msg.into()) }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        // Нарушения ограничений БД — это ошибки ввода/состояния, а не сбой сервера.
        if let sqlx::Error::Database(db) = &e {
            match db.code().as_deref() {
                Some("23505") => return AppError::Conflict("Такая запись уже существует".into()),
                Some("23514") => {
                    // check_violation: наши триггеры бросают понятный русский текст
                    let m = db.message();
                    let text = if m.contains("violates check constraint") {
                        "Данные не прошли проверку ограничений".to_string()
                    } else {
                        m.to_string()
                    };
                    return AppError::Conflict(text);
                }
                Some("23503") => return AppError::Conflict("Связанная запись не найдена или используется".into()),
                _ => {}
            }
        }
        AppError::Internal(anyhow::Error::new(e))
    }
}

impl From<AppError> for async_graphql::Error {
    fn from(e: AppError) -> Self {
        let code = e.code();
        if let AppError::Internal(inner) = &e {
            tracing::error!(error = ?inner, "внутренняя ошибка");
        }
        let message = e.message();
        async_graphql::Error::new(message).extend_with(|_, ext| ext.set("code", code))
    }
}

pub type AppResult<T> = Result<T, AppError>;
