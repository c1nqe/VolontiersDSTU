//! Шифрование персональных данных, записанных до миграции 0007 (или напрямую SQL).
//! Запускается после миграций при каждом старте и командой `migrate`; повторный запуск ничего не меняет.
use sqlx::{PgConnection, PgPool};
use uuid::Uuid;

use crate::crypto::{blind_index, email_index, seal};

/// Заглушка удалённой учётной записи — не персональные данные, остаётся как есть и без индекса.
fn is_tombstone(email: &str) -> bool { email.ends_with("@deleted.invalid") }
fn is_hex64(s: &str) -> bool { s.len() == 64 && s.bytes().all(|c| c.is_ascii_hexdigit()) }

async fn seal_column(conn: &mut PgConnection, table: &str, column: &str) -> anyhow::Result<u64> {
    let rows: Vec<(Uuid, String)> = sqlx::query_as(&format!(
        "SELECT id, {column} FROM {table} WHERE {column} IS NOT NULL AND {column} <> '' AND {column} NOT LIKE 'enc:v1:%' AND {column} NOT LIKE '%@deleted.invalid'"
    )).fetch_all(&mut *conn).await?;
    for (id, value) in &rows {
        sqlx::query(&format!("UPDATE {table} SET {column} = $2 WHERE id = $1")).bind(id).bind(seal(value)).execute(&mut *conn).await?;
    }
    Ok(rows.len() as u64)
}

pub async fn encrypt_existing(pool: &PgPool) -> anyhow::Result<u64> {
    let mut tx = pool.begin().await?;
    let mut n = 0;

    // индексы почты считаются по открытому значению, поэтому — до шифрования столбца
    for table in ["users", "volonteers"] {
        let rows: Vec<(Uuid, String)> = sqlx::query_as(&format!("SELECT id, email FROM {table} WHERE email_hash IS NULL AND email NOT LIKE 'enc:v1:%'"))
            .fetch_all(&mut *tx).await?;
        for (id, email) in rows.iter().filter(|(_, e)| !is_tombstone(e)) {
            sqlx::query(&format!("UPDATE {table} SET email_hash = $2 WHERE id = $1")).bind(id).bind(email_index(email)).execute(&mut *tx).await?;
        }
        n += seal_column(&mut tx, table, "email").await?;
    }
    n += seal_column(&mut tx, "volonteers", "phone").await?;
    n += seal_column(&mut tx, "volonteers", "student_id").await?;
    n += seal_column(&mut tx, "organizations", "email").await?;
    n += seal_column(&mut tx, "organizations", "phone").await?;
    n += seal_column(&mut tx, "map_markers", "contact_phone").await?;
    n += seal_column(&mut tx, "persons", "birth_date").await?;

    // persons.phone_hash: в 0006 там лежал нормализованный номер — заменяем его индексом
    let phones: Vec<(Uuid, String)> = sqlx::query_as("SELECT id, phone_hash FROM persons WHERE phone_hash IS NOT NULL").fetch_all(&mut *tx).await?;
    for (id, value) in phones.iter().filter(|(_, v)| !is_hex64(v)) {
        sqlx::query("UPDATE persons SET phone_hash = $2 WHERE id = $1").bind(id).bind(blind_index(value)).execute(&mut *tx).await?;
        n += 1;
    }
    tx.commit().await?;
    if n > 0 { tracing::info!("зашифровано значений персональных данных: {n}"); }
    Ok(n)
}
