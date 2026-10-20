-- ============================================================================
-- 0006 · один человек — одна учётная запись; отмена события организатором
--        только с согласия администратора
--
-- persons.phone — нормализованный номер (+7XXXXXXXXXX). Уникален: второй аккаунт
-- на тот же телефон (например, волонтёр + организатор) создать нельзя.
-- events.cancel_requested_at — организатор попросил отменить принятое событие;
-- событие остаётся ACCEPTED, пока администратор не согласует или не отклонит запрос.
-- ============================================================================

ALTER TABLE persons ADD COLUMN phone text CHECK (phone IS NULL OR phone ~ '^\+[0-9]{10,15}$');
CREATE UNIQUE INDEX persons_phone_uq ON persons (phone);

-- перенос телефонов уже существующих волонтёров; при совпадении номер получает самая ранняя запись
WITH n AS (
    SELECT v.person_id, v.created_at,
           '+' || CASE WHEN d ~ '^8[0-9]{10}$' THEN '7' || substr(d, 2)
                       WHEN length(d) = 10      THEN '7' || d
                       ELSE d END AS ph
      FROM volonteers v, LATERAL (SELECT regexp_replace(v.phone, '\D', '', 'g') AS d) x
     WHERE length(x.d) BETWEEN 10 AND 15
), u AS (
    SELECT DISTINCT ON (ph) person_id, ph FROM n ORDER BY ph, created_at
)
UPDATE persons p SET phone = u.ph FROM u WHERE p.id = u.person_id;

ALTER TABLE events
    ADD COLUMN cancel_requested_at timestamptz,
    ADD COLUMN cancel_requested_by uuid REFERENCES users (id) ON DELETE SET NULL;
CREATE INDEX events_cancel_requested_idx ON events (cancel_requested_at) WHERE cancel_requested_at IS NOT NULL;
