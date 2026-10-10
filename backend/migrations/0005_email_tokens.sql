-- ============================================================================
-- 0005 · подтверждение электронной почты и восстановление пароля
--
-- В базе хранится только SHA-256 от токена: утечка таблицы не даёт доступа к ссылкам.
-- Токен одноразовый (used_at) и ограничен по времени (expires_at).
-- ============================================================================

CREATE TYPE email_token_purpose AS ENUM ('VERIFY_EMAIL', 'RESET_PASSWORD');

ALTER TABLE users ADD COLUMN email_verified_at timestamptz;
-- Уже существующие учётные записи считаем подтверждёнными (их создавал администратор или сид)
UPDATE users SET email_verified_at = created_at WHERE deleted_at IS NULL;

CREATE TABLE email_tokens (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id    uuid NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    purpose    email_token_purpose NOT NULL,
    token_hash text NOT NULL UNIQUE CHECK (token_hash ~ '^[0-9a-f]{64}$'),
    sent_to    text NOT NULL,                 -- адрес, на который ушла ссылка: после смены адреса ссылка не действует
    expires_at timestamptz NOT NULL,
    used_at    timestamptz,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX email_tokens_user_idx ON email_tokens (user_id, purpose, created_at DESC);
