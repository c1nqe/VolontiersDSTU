//! Защита персональных данных в БД.
//!
//! * Контакты (почта, телефон, дата рождения, номер студенческого билета, контактный телефон метки)
//!   хранятся зашифрованными: AES-256-GCM, случайный nonce на каждое значение, формат `enc:v1:<base64(nonce‖шифртекст‖тег)>`.
//!   Утечка дампа или резервной копии БД без ключа не раскрывает эти данные.
//! * Для поиска и уникальности (вход по почте, «один телефон — одна учётная запись») рядом хранится
//!   «слепой индекс» — HMAC-SHA256 от нормализованного значения. Он необратим и без ключа бесполезен для перебора.
//!
//! Оба ключа выводятся из одного мастер-ключа `DATA_ENCRYPTION_KEY` (32 байта в hex). Потеря ключа = потеря
//! зашифрованных данных, поэтому ключ хранится вне БД и входит в резервную копию отдельно от неё.
use std::sync::OnceLock;

use aes_gcm::{aead::{Aead, KeyInit}, Aes256Gcm, Nonce};
use base64::{engine::general_purpose::STANDARD, Engine};
use hmac::{Hmac, Mac};
use rand::RngCore;
use sha2::Sha256;

const PREFIX: &str = "enc:v1:";

struct Keys { cipher: Aes256Gcm, index: Vec<u8> }

static KEYS: OnceLock<Keys> = OnceLock::new();

fn derive(master: &[u8; 32], label: &[u8]) -> [u8; 32] {
    let mut m = <Hmac<Sha256> as Mac>::new_from_slice(master).expect("HMAC принимает ключ любой длины");
    m.update(label);
    m.finalize().into_bytes().into()
}

/// Ключи задаются один раз при старте процесса (сервер, команды CLI, тесты).
pub fn init(master: &[u8; 32]) {
    let _ = KEYS.set(Keys {
        cipher: Aes256Gcm::new_from_slice(&derive(master, b"volontiers/pii-encryption/v1")).expect("32 байта"),
        index: derive(master, b"volontiers/pii-blind-index/v1").to_vec(),
    });
}

fn keys() -> &'static Keys {
    KEYS.get().expect("crypto::init не вызван: ключ шифрования персональных данных не задан")
}

/// Зашифровать значение. Пустая строка остаётся пустой (поле «не заполнено»).
pub fn seal(plain: &str) -> String {
    if plain.is_empty() { return String::new(); }
    let mut nonce = [0u8; 12];
    rand::thread_rng().fill_bytes(&mut nonce);
    let ct = keys().cipher.encrypt(Nonce::from_slice(&nonce), plain.as_bytes()).expect("AES-GCM не отказывает при шифровании");
    let mut buf = nonce.to_vec();
    buf.extend_from_slice(&ct);
    format!("{PREFIX}{}", STANDARD.encode(buf))
}
pub fn seal_opt(plain: Option<&str>) -> Option<String> { plain.map(seal) }

/// Расшифровать значение. Строки без префикса (пустые, служебные заглушки удалённых аккаунтов,
/// данные до шифрования) возвращаются как есть. Повреждённый шифртекст даёт пустую строку и запись в лог.
pub fn open(stored: &str) -> String {
    let Some(b64) = stored.strip_prefix(PREFIX) else { return stored.to_string() };
    let opened = STANDARD.decode(b64).ok().filter(|raw| raw.len() > 12).and_then(|raw| {
        keys().cipher.decrypt(Nonce::from_slice(&raw[..12]), &raw[12..]).ok()
    }).and_then(|p| String::from_utf8(p).ok());
    opened.unwrap_or_else(|| {
        tracing::error!("не удалось расшифровать персональные данные: неверный DATA_ENCRYPTION_KEY или повреждённое значение");
        String::new()
    })
}
pub fn open_opt(stored: Option<String>) -> Option<String> { stored.map(|s| open(&s)).filter(|s| !s.is_empty()) }

pub fn is_sealed(stored: &str) -> bool { stored.starts_with(PREFIX) }

/// Слепой индекс: HMAC-SHA256 (hex) от уже нормализованного значения.
pub fn blind_index(normalized: &str) -> String {
    let mut m = <Hmac<Sha256> as Mac>::new_from_slice(&keys().index).expect("ключ HMAC");
    m.update(normalized.as_bytes());
    hex::encode(m.finalize().into_bytes())
}
/// Индекс адреса почты: регистр и пробелы по краям не важны.
pub fn email_index(email: &str) -> String { blind_index(&email.trim().to_lowercase()) }

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn seal_open_roundtrip_and_index() {
        init(&[7u8; 32]);
        let a = seal("ivan@donstu.ru");
        let b = seal("ivan@donstu.ru");
        assert!(a.starts_with(PREFIX) && a != b, "каждое шифрование со своим nonce");
        assert!(!a.contains("ivan"), "в шифртексте нет исходного значения");
        assert_eq!(open(&a), "ivan@donstu.ru");
        assert_eq!(seal(""), "");
        assert_eq!(open("legacy-plain"), "legacy-plain", "незашифрованные значения читаются как есть");
        assert_eq!(email_index(" Ivan@DonSTU.ru "), email_index("ivan@donstu.ru"));
        assert_ne!(blind_index("+79001234567"), blind_index("+79001234568"));
        assert_eq!(blind_index("x").len(), 64);
        // подмена шифртекста обнаруживается (GCM-тег)
        let mut tampered = a.clone();
        tampered.pop();
        tampered.push(if a.ends_with('A') { 'B' } else { 'A' });
        assert_eq!(open(&tampered), "");
    }
}
