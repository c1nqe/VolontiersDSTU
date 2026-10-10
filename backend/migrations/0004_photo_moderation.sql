-- ============================================================================
-- 0004 · предварительная модерация фотографий меток ПСО (решение заказчика)
--
-- Фото метки, загруженное не администратором, сначала получает статус PENDING:
-- его видят только автор и администраторы. После одобрения (APPROVED) фото
-- становится видно всем, кому разрешён просмотр фото меток. Отклонённое фото
-- удаляется из БД вместе с содержимым; причина остаётся в журнале аудита.
-- Существующие фото и фото-отчёты о закрытии считаются одобренными.
-- ============================================================================

CREATE TYPE photo_status AS ENUM ('PENDING', 'APPROVED');

ALTER TABLE photos
    ADD COLUMN status       photo_status NOT NULL DEFAULT 'APPROVED',
    ADD COLUMN moderated_by uuid REFERENCES users (id) ON DELETE SET NULL,
    ADD COLUMN moderated_at timestamptz;

CREATE INDEX photos_pending_idx ON photos (created_at) WHERE status = 'PENDING';
