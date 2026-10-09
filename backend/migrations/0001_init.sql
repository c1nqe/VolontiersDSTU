-- ============================================================================
-- VolontiersDSTU · PostgreSQL 16 · начальная схема
--
-- Основа — модель из задания (DataSpace-style):
--   Aggregate Organization : Organization(name, eventList), Event(...)
--   Aggregate Volonteer    : Volonteer(person, eventBookingList), VolonteerEventRequest(...)
--   Aggregate Person       : Person(firstName, lastName, birthDate)
--   Event   : DRAFT → CANCELLED | ACCEPTED → CLOSED
--   Request : OPEN  → CANCELLED | ACCEPTED → CONFIRMED
--
-- Расширения сверх картинки (см. docs/BACKEND.md): users (учётные записи), отзывы,
-- метки карты, фотографии (bytea), журнал аудита.
-- Допустимость переходов статусов гарантирует сама БД (триггеры), а не только код.
-- ============================================================================

-- ---------- Типы -------------------------------------------------------------
CREATE TYPE user_role      AS ENUM ('ADMIN', 'ORGANIZER', 'VOLUNTEER');
CREATE TYPE event_status   AS ENUM ('DRAFT', 'ACCEPTED', 'CANCELLED', 'CLOSED');
CREATE TYPE request_status AS ENUM ('OPEN', 'ACCEPTED', 'CANCELLED', 'CONFIRMED');
CREATE TYPE marker_type    AS ENUM ('REGULAR', 'SEARCH_RESCUE');
CREATE TYPE marker_status  AS ENUM ('ACTIVE', 'PENDING_APPROVAL', 'FOUND', 'CLOSED');
CREATE TYPE urgency        AS ENUM ('HIGH', 'MEDIUM', 'LOW');
CREATE TYPE photo_purpose  AS ENUM ('MARKER', 'CLOSURE');

-- ---------- Aggregate Person -------------------------------------------------
CREATE TABLE persons (
    id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    first_name  text NOT NULL CHECK (length(btrim(first_name)) BETWEEN 1 AND 100),
    last_name   text NOT NULL CHECK (length(btrim(last_name))  BETWEEN 1 AND 100),
    middle_name text CHECK (middle_name IS NULL OR length(middle_name) <= 100),
    birth_date  date CHECK (birth_date IS NULL OR (birth_date > DATE '1900-01-01' AND birth_date <= CURRENT_DATE)),
    created_at  timestamptz NOT NULL DEFAULT now()
);

-- ---------- Aggregate Organization -------------------------------------------
CREATE TABLE organizations (
    id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    name           text NOT NULL CHECK (length(btrim(name)) BETWEEN 2 AND 200),
    inn            text CHECK (inn IS NULL OR inn ~ '^[0-9]{10}([0-9]{2})?$'),
    contact_person text NOT NULL DEFAULT '' CHECK (length(contact_person) <= 200),
    email          text NOT NULL DEFAULT '' CHECK (length(email) <= 254),
    phone          text NOT NULL DEFAULT '' CHECK (length(phone) <= 40),
    description    text CHECK (description IS NULL OR length(description) <= 2000),
    created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX organizations_name_uq ON organizations (lower(name));

CREATE TABLE events (
    id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id     uuid NOT NULL REFERENCES organizations (id) ON DELETE RESTRICT,
    title               text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
    description         text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 4000),
    location            text NOT NULL CHECK (length(btrim(location)) BETWEEN 1 AND 300),
    start_at            timestamptz NOT NULL,          -- Event.startDateTime
    end_at              timestamptz NOT NULL,          -- Event.endDateTime
    required_volunteers integer NOT NULL CHECK (required_volunteers BETWEEN 1 AND 10000),
    planned_hours       numeric(6,1) NOT NULL CHECK (planned_hours > 0 AND planned_hours <= 744),
    status              event_status NOT NULL DEFAULT 'DRAFT',
    created_at          timestamptz NOT NULL DEFAULT now(),
    updated_at          timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT events_period_ck CHECK (end_at >= start_at)
);
CREATE INDEX events_org_idx    ON events (organization_id);
CREATE INDEX events_status_idx ON events (status, start_at);

-- ---------- Aggregate Volonteer ----------------------------------------------
CREATE TABLE volonteers (
    id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id  uuid NOT NULL UNIQUE REFERENCES persons (id) ON DELETE RESTRICT,
    email      text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
    phone      text NOT NULL DEFAULT '' CHECK (length(phone) <= 40),
    student_id text CHECK (student_id IS NULL OR length(student_id) <= 40),
    faculty    text CHECK (faculty IS NULL OR length(faculty) <= 200),
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX volonteers_email_uq ON volonteers (lower(email));

CREATE TABLE volonteer_event_requests (
    id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    volonteer_id     uuid NOT NULL REFERENCES volonteers (id) ON DELETE RESTRICT,
    event_id         uuid NOT NULL REFERENCES events (id)     ON DELETE RESTRICT,
    description      text CHECK (description IS NULL OR length(description) <= 1000),
    status           request_status NOT NULL DEFAULT 'OPEN',
    requested_hours  numeric(6,1) NOT NULL CHECK (requested_hours > 0 AND requested_hours <= 744),
    confirmed_hours  numeric(6,1) CHECK (confirmed_hours IS NULL OR (confirmed_hours >= 0 AND confirmed_hours <= 744)),
    rejection_reason text CHECK (rejection_reason IS NULL OR length(rejection_reason) <= 500),
    created_at       timestamptz NOT NULL DEFAULT now(),
    updated_at       timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT request_once_per_event UNIQUE (volonteer_id, event_id),
    -- часы проставляются тогда и только тогда, когда факт работы подтверждён
    CONSTRAINT request_hours_ck CHECK ((status = 'CONFIRMED') = (confirmed_hours IS NOT NULL))
);
CREATE INDEX requests_event_idx ON volonteer_event_requests (event_id, status);
CREATE INDEX requests_vol_idx   ON volonteer_event_requests (volonteer_id, status);

-- ---------- Учётные записи (расширение) --------------------------------------
CREATE TABLE users (
    id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    person_id       uuid NOT NULL UNIQUE REFERENCES persons (id) ON DELETE RESTRICT,
    email           text NOT NULL CHECK (length(email) BETWEEN 3 AND 254),
    password_hash   text NOT NULL,                       -- argon2id, PHC-строка
    role            user_role NOT NULL,
    organization_id uuid REFERENCES organizations (id) ON DELETE RESTRICT,
    volonteer_id    uuid UNIQUE REFERENCES volonteers (id) ON DELETE RESTRICT,
    token_version   integer NOT NULL DEFAULT 0,          -- ++ при выходе/смене пароля → старые JWT недействительны
    failed_logins   smallint NOT NULL DEFAULT 0,
    locked_until    timestamptz,
    last_login_at   timestamptz,
    created_at      timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT users_role_link_ck CHECK (
        (role = 'ORGANIZER' AND organization_id IS NOT NULL AND volonteer_id IS NULL) OR
        (role = 'VOLUNTEER' AND volonteer_id IS NOT NULL AND organization_id IS NULL) OR
        (role = 'ADMIN'     AND organization_id IS NULL AND volonteer_id IS NULL)
    )
);
CREATE UNIQUE INDEX users_email_uq ON users (lower(email));

-- ---------- Отзывы -----------------------------------------------------------
CREATE TABLE event_reviews (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    event_id     uuid NOT NULL REFERENCES events (id)     ON DELETE CASCADE,
    volonteer_id uuid NOT NULL REFERENCES volonteers (id) ON DELETE CASCADE,
    author_name  text NOT NULL CHECK (length(author_name) BETWEEN 1 AND 200),
    rating       smallint NOT NULL CHECK (rating BETWEEN 1 AND 5),
    text         text NOT NULL CHECK (length(text) BETWEEN 10 AND 1000),
    created_at   timestamptz NOT NULL DEFAULT now(),
    updated_at   timestamptz,
    CONSTRAINT one_review_per_participant UNIQUE (event_id, volonteer_id)
);

-- ---------- Карта: метки, фотографии, отчёты о закрытии ----------------------
CREATE TABLE map_markers (
    id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    type               marker_type NOT NULL,
    status             marker_status NOT NULL DEFAULT 'ACTIVE',
    title              text NOT NULL CHECK (length(btrim(title)) BETWEEN 3 AND 200),
    description        text NOT NULL CHECK (length(btrim(description)) BETWEEN 1 AND 4000),
    lat                double precision NOT NULL CHECK (lat BETWEEN -90 AND 90),
    lng                double precision NOT NULL CHECK (lng BETWEEN -180 AND 180),
    urgency            urgency NOT NULL DEFAULT 'MEDIUM',
    contact_phone      text CHECK (contact_phone IS NULL OR length(contact_phone) <= 40),
    last_seen_date     date,
    last_seen_location text CHECK (last_seen_location IS NULL OR length(last_seen_location) <= 300),
    created_by         uuid REFERENCES users (id) ON DELETE SET NULL,
    created_by_name    text NOT NULL,
    created_at         timestamptz NOT NULL DEFAULT now(),
    updated_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX markers_status_idx ON map_markers (status, type);

CREATE TABLE photos (
    id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    marker_id    uuid REFERENCES map_markers (id) ON DELETE CASCADE,
    purpose      photo_purpose NOT NULL,
    position     smallint NOT NULL DEFAULT 0 CHECK (position BETWEEN 0 AND 4),
    content_type text NOT NULL CHECK (content_type IN ('image/jpeg', 'image/png', 'image/webp')),
    data         bytea NOT NULL CHECK (octet_length(data) BETWEEN 100 AND 3145728),
    size_bytes   integer NOT NULL,
    sha256       text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
    uploaded_by  uuid REFERENCES users (id) ON DELETE SET NULL,
    created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX photos_marker_pos_uq ON photos (marker_id, purpose, position) WHERE purpose = 'MARKER';
CREATE INDEX photos_marker_idx ON photos (marker_id);

CREATE TABLE marker_closures (
    id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    marker_id     uuid NOT NULL REFERENCES map_markers (id) ON DELETE CASCADE,
    photo_id      uuid REFERENCES photos (id) ON DELETE SET NULL,
    note          text NOT NULL DEFAULT '' CHECK (length(note) <= 2000),
    target_status marker_status NOT NULL CHECK (target_status IN ('FOUND', 'CLOSED')),
    submitted_by  uuid REFERENCES users (id) ON DELETE SET NULL,
    submitted_by_name text NOT NULL,
    submitted_at  timestamptz NOT NULL DEFAULT now(),
    approved_at   timestamptz,
    approved_by   text,
    rejected_at   timestamptz,
    reject_reason text CHECK (reject_reason IS NULL OR length(reject_reason) <= 500)
);
CREATE INDEX closures_marker_idx ON marker_closures (marker_id, submitted_at DESC);

-- ---------- Журнал аудита (append-only) ---------------------------------------
CREATE TABLE audit_log (
    id            bigserial PRIMARY KEY,
    at            timestamptz NOT NULL DEFAULT now(),
    actor_user_id uuid,
    actor_role    user_role,
    action        text NOT NULL,
    entity        text,
    entity_id     uuid,
    details       jsonb NOT NULL DEFAULT '{}'::jsonb
);
CREATE INDEX audit_entity_idx ON audit_log (entity, entity_id);
CREATE INDEX audit_actor_idx  ON audit_log (actor_user_id, at DESC);

-- ============================================================================
-- Триггеры: автомат состояний и инварианты
-- ============================================================================
CREATE FUNCTION trg_touch_updated_at() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at := now();
    RETURN NEW;
END $$;

CREATE TRIGGER events_touch   BEFORE UPDATE ON events                    FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();
CREATE TRIGGER requests_touch BEFORE UPDATE ON volonteer_event_requests  FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();
CREATE TRIGGER markers_touch  BEFORE UPDATE ON map_markers               FOR EACH ROW EXECUTE FUNCTION trg_touch_updated_at();

-- Event: DRAFT → CANCELLED | ACCEPTED → CLOSED
CREATE FUNCTION trg_event_state() RETURNS trigger LANGUAGE plpgsql AS $$
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
    IF (OLD.status = 'DRAFT'    AND NEW.status IN ('ACCEPTED', 'CANCELLED'))
    OR (OLD.status = 'ACCEPTED' AND NEW.status = 'CLOSED') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Недопустимый переход статуса события: % → %', OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER events_state BEFORE INSERT OR UPDATE ON events FOR EACH ROW EXECUTE FUNCTION trg_event_state();

-- Request: OPEN → CANCELLED | ACCEPTED → CONFIRMED
CREATE FUNCTION trg_request_state() RETURNS trigger LANGUAGE plpgsql AS $$
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
    IF (OLD.status = 'OPEN'     AND NEW.status IN ('ACCEPTED', 'CANCELLED'))
    OR (OLD.status = 'ACCEPTED' AND NEW.status = 'CONFIRMED') THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Недопустимый переход статуса заявки: % → %', OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER requests_state BEFORE INSERT OR UPDATE ON volonteer_event_requests FOR EACH ROW EXECUTE FUNCTION trg_request_state();

-- Marker: ACTIVE → PENDING_APPROVAL | CLOSED;  PENDING_APPROVAL → ACTIVE | FOUND | CLOSED
CREATE FUNCTION trg_marker_state() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF TG_OP = 'INSERT' OR NEW.status = OLD.status THEN
        RETURN NEW;
    END IF;
    IF (OLD.status = 'ACTIVE'           AND NEW.status IN ('PENDING_APPROVAL', 'CLOSED'))
    OR (OLD.status = 'PENDING_APPROVAL' AND NEW.status IN ('ACTIVE', 'FOUND', 'CLOSED')) THEN
        RETURN NEW;
    END IF;
    RAISE EXCEPTION 'Недопустимый переход статуса метки: % → %', OLD.status, NEW.status
        USING ERRCODE = 'check_violation';
END $$;
CREATE TRIGGER markers_state BEFORE INSERT OR UPDATE ON map_markers FOR EACH ROW EXECUTE FUNCTION trg_marker_state();

-- Отзыв: только участник (заявка CONFIRMED либо ACCEPTED на закрытом событии)
CREATE FUNCTION trg_review_participant() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
          FROM volonteer_event_requests r
          JOIN events e ON e.id = r.event_id
         WHERE r.volonteer_id = NEW.volonteer_id
           AND r.event_id = NEW.event_id
           AND (r.status = 'CONFIRMED' OR (r.status = 'ACCEPTED' AND e.status = 'CLOSED'))
    ) THEN
        RAISE EXCEPTION 'Отзыв может оставить только участник мероприятия' USING ERRCODE = 'check_violation';
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER reviews_participant BEFORE INSERT OR UPDATE OF event_id, volonteer_id ON event_reviews
    FOR EACH ROW EXECUTE FUNCTION trg_review_participant();

-- Фото: не более 5 фотографий метки, фото только у меток ПСО
CREATE FUNCTION trg_photo_limits() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mt marker_type; cnt integer;
BEGIN
    IF NEW.marker_id IS NULL THEN
        RETURN NEW;      -- «сирота» до привязки к метке (в одной транзакции)
    END IF;
    IF NEW.purpose = 'MARKER' THEN
        SELECT type INTO mt FROM map_markers WHERE id = NEW.marker_id;
        IF mt IS DISTINCT FROM 'SEARCH_RESCUE' THEN
            RAISE EXCEPTION 'Фотографии прикрепляются только к меткам ПСО' USING ERRCODE = 'check_violation';
        END IF;
        SELECT count(*) INTO cnt FROM photos WHERE marker_id = NEW.marker_id AND purpose = 'MARKER';
        IF cnt >= 5 THEN
            RAISE EXCEPTION 'К метке можно прикрепить не более 5 фотографий' USING ERRCODE = 'check_violation';
        END IF;
    END IF;
    RETURN NEW;
END $$;
CREATE TRIGGER photos_limits BEFORE INSERT ON photos FOR EACH ROW EXECUTE FUNCTION trg_photo_limits();

-- Журнал аудита нельзя менять и удалять
CREATE FUNCTION trg_audit_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    RAISE EXCEPTION 'audit_log доступен только для добавления записей' USING ERRCODE = 'insufficient_privilege';
END $$;
CREATE TRIGGER audit_no_update BEFORE UPDATE OR DELETE ON audit_log FOR EACH ROW EXECUTE FUNCTION trg_audit_immutable();
CREATE TRIGGER audit_no_truncate BEFORE TRUNCATE ON audit_log FOR EACH STATEMENT EXECUTE FUNCTION trg_audit_immutable();
