//! Отправка писем. Три режима: SMTP (рабочий), Outbox (тесты: письма складываются в память), Disabled.
//! Тексты писем и сами токены в журнал не пишутся.
use std::{sync::Mutex, time::Duration};

use anyhow::Context;
use lettre::{
    message::{header::ContentType, Mailbox},
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};

use crate::config::{Config, SmtpTls};

#[derive(Clone, Debug)]
pub struct Mail {
    pub to: String,
    pub subject: String,
    pub text: String,
}

#[allow(clippy::large_enum_variant)] // один экземпляр на весь процесс, в Arc
pub enum Mailer {
    Disabled,
    Smtp { transport: AsyncSmtpTransport<Tokio1Executor>, from: Mailbox },
    Outbox(Mutex<Vec<Mail>>),
}

impl Mailer {
    pub fn from_config(cfg: &Config) -> anyhow::Result<Mailer> {
        let Some(host) = cfg.smtp_host.as_deref() else { return Ok(Mailer::Disabled) };
        let from: Mailbox = cfg.smtp_from.as_deref().context("не задан SMTP_FROM")?.parse().context("SMTP_FROM: неверный адрес отправителя")?;
        let mut b = match cfg.smtp_tls {
            SmtpTls::StartTls => AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(host).context("SMTP_HOST")?,
            SmtpTls::Tls => AsyncSmtpTransport::<Tokio1Executor>::relay(host).context("SMTP_HOST")?,
            SmtpTls::None => AsyncSmtpTransport::<Tokio1Executor>::builder_dangerous(host),
        };
        b = b.port(cfg.smtp_port).timeout(Some(Duration::from_secs(20)));
        if let (Some(user), Some(pass)) = (cfg.smtp_user.as_deref(), cfg.smtp_password.as_ref()) {
            b = b.credentials(Credentials::new(user.to_string(), pass.expose().to_string()));
        }
        Ok(Mailer::Smtp { transport: b.build(), from })
    }

    pub fn outbox() -> Mailer { Mailer::Outbox(Mutex::new(Vec::new())) }

    /// Можно ли вообще отправлять письма (иначе функции «забыли пароль» и подтверждения почты недоступны).
    pub fn enabled(&self) -> bool { !matches!(self, Mailer::Disabled) }

    /// Отправка не блокирует запрос и не влияет на его время ответа.
    pub fn send(&self, mail: Mail) {
        match self {
            Mailer::Disabled => tracing::warn!("письмо не отправлено: SMTP не настроен"),
            Mailer::Outbox(v) => v.lock().unwrap_or_else(|e| e.into_inner()).push(mail),
            Mailer::Smtp { transport, from } => {
                let (transport, from) = (transport.clone(), from.clone());
                tokio::spawn(async move {
                    let to: Mailbox = match mail.to.parse() {
                        Ok(m) => m,
                        Err(_) => { tracing::warn!("письмо не отправлено: неверный адрес получателя"); return; }
                    };
                    let msg = match Message::builder().from(from).to(to).subject(mail.subject).header(ContentType::TEXT_PLAIN).body(mail.text) {
                        Ok(m) => m,
                        Err(e) => { tracing::warn!(error = %e, "письмо не собрано"); return; }
                    };
                    if let Err(e) = transport.send(msg).await {
                        tracing::warn!(error = %e, "SMTP: письмо не отправлено");
                    }
                });
            }
        }
    }

    /// Только для тестов: забрать отправленные письма.
    pub fn take_outbox(&self) -> Vec<Mail> {
        match self {
            Mailer::Outbox(v) => std::mem::take(&mut *v.lock().unwrap_or_else(|e| e.into_inner())),
            _ => Vec::new(),
        }
    }
}

pub fn verification_mail(to: &str, name: &str, link: &str) -> Mail {
    Mail {
        to: to.to_string(),
        subject: "Подтвердите адрес электронной почты — Учёт волонтёров ДГТУ".into(),
        text: format!(
            "Здравствуйте, {name}!\n\nЧтобы подтвердить адрес электронной почты, перейдите по ссылке (действует 3 дня):\n{link}\n\n\
             Если вы не регистрировались в сервисе «Учёт волонтёров ДГТУ», просто проигнорируйте это письмо.\n"
        ),
    }
}

pub fn reset_mail(to: &str, name: &str, link: &str) -> Mail {
    Mail {
        to: to.to_string(),
        subject: "Восстановление пароля — Учёт волонтёров ДГТУ".into(),
        text: format!(
            "Здравствуйте, {name}!\n\nМы получили запрос на восстановление пароля. Ссылка для создания нового пароля действует 1 час и работает один раз:\n{link}\n\n\
             Если вы не запрашивали восстановление, ничего не делайте: пароль останется прежним.\n"
        ),
    }
}
