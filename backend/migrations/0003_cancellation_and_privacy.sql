-- ============================================================================
-- 0003 · отмена принятых событий и заявок, согласие на обработку ПДн (152-ФЗ)
--
--   Event   : DRAFT → CANCELLED | ACCEPTED → CANCELLED | CLOSED
--   Request : OPEN  → CANCELLED | ACCEPTED → CANCELLED | CONFIRMED
--
-- Новые переходы ACCEPTED → CANCELLED добавлены по решению заказчика (Q2).
-- ============================================================================

ALTER TABLE events ADD COLUMN cancel_reason text
    CHECK (cancel_reason IS NULL OR length(cancel_reason) <= 500);

-- Согласие на обработку персональных данных и «мягкое» удаление учётной записи
ALTER TABLE users
    ADD COLUMN consent_version text,
    ADD COLUMN consent_at      timestamptz,
    ADD COLUMN deleted_at      timestamptz,
    ADD CONSTRAINT users_consent_ck CHECK ((consent_version IS NULL) = (consent_at IS NULL));

-- ---------- Event: добавляем ACCEPTED → CANCELLED ---------------------------------
CREATE OR REPLACE FUNCTION trg_event_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'DRAFT' THEN
            RAISE EXCEPTION 'Событие создаётся только в статусе DRAFT' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.status = OLD.status THEN
        -- содержимое можно править только пока событие — черновик
        IF OLD.status <> 'DRAFT' AND (
              NEW.title IS DISTINCT FROM OLD.title OR NEW.description IS DISTINCT FROM OLD.description
           OR NEW.location IS DISTINCT FROM OLD.location OR NEW.start_at IS DISTINCT FROM OLD.start_at
           OR NEW.end_at IS DISTINCT FROM OLD.end_at OR NEW.organization_id IS DISTINCT FROM OLD.organization_id) THEN
            RAISE EXCEPTION 'Событие в статусе % нельзя редактировать', OLD.status USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;
    IF OLD.status = 'ACCEPTED' AND NEW.status = 'CANCELLED' THEN
        IF EXISTS (SELECT 1 FROM volonteer_event_requests WHERE event_id = OLD.id AND status = 'CONFIRMED') THEN
            RAISE EXCEPTION 'Нельзя отменить событие, по которому уже подтверждены часы работы' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;
    IF (OLD.status = 'DRAFT'    AND NEW.status IN ('ACCEPTED', 'CANCELLED'))
    OR (OLD.status = 'ACCEPTED' AND NEW.status = 'CLOSED') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Недопустимый переход статуса события: % → %', OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
END $$;

-- При отмене принятого события все его открытые и принятые заявки отменяются автоматически
CREATE FUNCTION trg_event_cancel_cascade() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF OLD.status = 'ACCEPTED' AND NEW.status = 'CANCELLED' THEN
        UPDATE volonteer_event_requests
           SET status = 'CANCELLED',
               rejection_reason = COALESCE(NEW.cancel_reason, 'Мероприятие отменено организатором')
         WHERE event_id = NEW.id AND status IN ('OPEN', 'ACCEPTED');
    END IF;
    RETURN NULL;
END $$;
CREATE TRIGGER events_cancel_cascade AFTER UPDATE OF status ON events
    FOR EACH ROW EXECUTE FUNCTION trg_event_cancel_cascade();

-- ---------- Request: добавляем ACCEPTED → CANCELLED -------------------------------
CREATE OR REPLACE FUNCTION trg_request_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ev event_status;
BEGIN
    IF TG_OP = 'INSERT' THEN
        IF NEW.status <> 'OPEN' THEN
            RAISE EXCEPTION 'Заявка создаётся только в статусе OPEN' USING ERRCODE = 'check_violation';
        END IF;
        SELECT status INTO ev FROM events WHERE id = NEW.event_id;
        IF ev IS DISTINCT FROM 'ACCEPTED' THEN
            RAISE EXCEPTION 'Подать заявку можно только на согласованное событие (ACCEPTED)' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;
    IF NEW.volonteer_id <> OLD.volonteer_id OR NEW.event_id <> OLD.event_id THEN
        RAISE EXCEPTION 'Нельзя менять волонтёра или событие заявки' USING ERRCODE = 'check_violation';
    END IF;
    IF NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;
    IF OLD.status = 'ACCEPTED' AND NEW.status = 'CANCELLED' THEN
        -- отменить принятую заявку можно, пока событие не проведено (при отмене события — каскадом)
        SELECT status INTO ev FROM events WHERE id = NEW.event_id;
        IF ev NOT IN ('ACCEPTED', 'CANCELLED') THEN
            RAISE EXCEPTION 'Принятую заявку нельзя отменить после закрытия события' USING ERRCODE = 'check_violation';
        END IF;
        RETURN NEW;
    END IF;
    IF (OLD.status = 'OPEN'     AND NEW.status IN ('ACCEPTED', 'CANCELLED'))
    OR (OLD.status = 'ACCEPTED' AND NEW.status = 'CONFIRMED') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Недопустимый переход статуса заявки: % → %', OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
END $$;
