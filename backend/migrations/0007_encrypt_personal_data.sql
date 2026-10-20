-- ============================================================================
-- 0007 · шифрование персональных данных
--
-- Почта, телефоны, дата рождения и номер студенческого билета хранятся зашифрованными
-- (AES-256-GCM на стороне сервера, см. backend/src/crypto.rs). Для поиска и уникальности —
-- «слепые индексы» *_hash: HMAC-SHA256 от нормализованного значения.
--
-- Сами значения шифрует сервер сразу после этой миграции (crypto-backfill в pii.rs):
-- SQL ключа не знает. До шифрования строки остаются читаемыми, сервер понимает оба вида.
-- Длина зашифрованного значения больше исходной, поэтому ограничения длины переезжают в код.
-- ============================================================================

-- ---------- users.email ------------------------------------------------------
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_email_check;
ALTER TABLE users ADD COLUMN email_hash text CHECK (email_hash IS NULL OR email_hash ~ '^[0-9a-f]{64}$');
DROP INDEX IF EXISTS users_email_uq;
CREATE UNIQUE INDEX users_email_hash_uq ON users (email_hash);

-- ---------- volonteers: email, phone, student_id ------------------------------
ALTER TABLE volonteers DROP CONSTRAINT IF EXISTS volonteers_email_check;
ALTER TABLE volonteers DROP CONSTRAINT IF EXISTS volonteers_phone_check;
ALTER TABLE volonteers DROP CONSTRAINT IF EXISTS volonteers_student_id_check;
ALTER TABLE volonteers ADD COLUMN email_hash text CHECK (email_hash IS NULL OR email_hash ~ '^[0-9a-f]{64}$');
DROP INDEX IF EXISTS volonteers_email_uq;
CREATE UNIQUE INDEX volonteers_email_hash_uq ON volonteers (email_hash);

-- ---------- persons: телефон (только индекс) и дата рождения -------------------
-- нормализованный телефон нужен лишь для правила «один человек — одна учётная запись»:
-- хранится только его хэш, сам номер (для показа) лежит зашифрованным в volonteers/organizations
ALTER TABLE persons DROP CONSTRAINT IF EXISTS persons_phone_check;
ALTER TABLE persons RENAME COLUMN phone TO phone_hash;
ALTER INDEX persons_phone_uq RENAME TO persons_phone_hash_uq;
ALTER TABLE persons DROP CONSTRAINT IF EXISTS persons_birth_date_check;
ALTER TABLE persons ALTER COLUMN birth_date TYPE text USING to_char(birth_date, 'YYYY-MM-DD');

-- ---------- organizations: email, phone ----------------------------------------
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_email_check;
ALTER TABLE organizations DROP CONSTRAINT IF EXISTS organizations_phone_check;

-- ---------- map_markers.contact_phone -------------------------------------------
ALTER TABLE map_markers DROP CONSTRAINT IF EXISTS map_markers_contact_phone_check;

-- ---------- email_tokens.sent_to: вместо адреса — его хэш -----------------------
-- ссылки живут не больше 3 суток; незавершённые перевыпускаются по запросу
DELETE FROM email_tokens WHERE used_at IS NULL;
UPDATE email_tokens SET sent_to = '';
