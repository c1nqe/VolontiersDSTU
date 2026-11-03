-- id/FK: SHA-256 hex stored in the database, serial_id: private SERIAL counter.
-- Run with the application stopped, as the schema and JWT subject format change.
-- SQLx runs this migration in a transaction: any failure restores the old schema.

LOCK TABLE persons, organizations, events, volonteers, volonteer_event_requests,
    users, event_reviews, map_markers, photos, marker_closures, audit_log,
    email_tokens IN ACCESS EXCLUSIVE MODE;

-- Save the exact FK definitions, including ON DELETE behavior and uniqueness.
CREATE TEMP TABLE vt_id_foreign_keys ON COMMIT DROP AS
SELECT conrelid::regclass AS tbl, conname, pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE contype = 'f' AND connamespace = 'public'::regnamespace;

DO $$
DECLARE r record;
BEGIN
    FOR r IN SELECT * FROM vt_id_foreign_keys LOOP
        EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', r.tbl, r.conname);
    END LOOP;
END $$;

-- UPDATE OF records a catalog dependency on the UUID columns. Disabling alone
-- does not release it; recreate this trigger after the type conversion.
DROP TRIGGER reviews_participant ON event_reviews;

-- One deterministic conversion for both ends of every existing relationship.
-- UUIDs already contain entropy; they are not replaced by a hash of 1, 2, 3, ...
DO $$
DECLARE t text; c record;
BEGIN
    FOREACH t IN ARRAY ARRAY['persons','organizations','events','volonteers',
        'volonteer_event_requests','users','event_reviews','map_markers',
        'photos','marker_closures','audit_log','email_tokens'] LOOP
        EXECUTE format('ALTER TABLE %I DISABLE TRIGGER USER', t);
        IF t <> 'audit_log' THEN
            EXECUTE format('ALTER TABLE %I ADD COLUMN serial_id serial UNIQUE CHECK (serial_id > 0)', t);
        END IF;
        FOR c IN SELECT column_name FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = t AND udt_name = 'uuid'
        LOOP
            EXECUTE format('ALTER TABLE %I ALTER COLUMN %I DROP DEFAULT', t, c.column_name);
            EXECUTE format('ALTER TABLE %I ALTER COLUMN %I TYPE text USING encode(sha256(convert_to(%I::text, ''UTF8'')), ''hex'')', t, c.column_name, c.column_name);
            EXECUTE format('ALTER TABLE %I ADD CONSTRAINT %I CHECK (%I ~ ''^[0-9a-f]{64}$'')', t, t || '_' || c.column_name || '_hash_ck', c.column_name);
        END LOOP;
    END LOOP;
END $$;

-- Keep the existing chronological audit counter, narrowing it only if it fits.
-- Overflow aborts the migration rather than renumbering or deleting audit rows.
ALTER TABLE audit_log RENAME COLUMN id TO serial_id;
ALTER TABLE audit_log ALTER COLUMN serial_id TYPE integer;
ALTER SEQUENCE audit_log_id_seq AS integer;
ALTER TABLE audit_log DROP CONSTRAINT audit_log_pkey;
ALTER TABLE audit_log ADD UNIQUE (serial_id);
ALTER TABLE audit_log ADD CHECK (serial_id > 0);
ALTER TABLE audit_log ADD COLUMN id text;
UPDATE audit_log SET id = encode(sha256(convert_to(
    'audit_log:' || serial_id::text || ':' || gen_random_uuid()::text, 'UTF8')), 'hex');
ALTER TABLE audit_log ALTER COLUMN id SET NOT NULL;
ALTER TABLE audit_log ADD PRIMARY KEY (id);
ALTER TABLE audit_log ADD CHECK (id ~ '^[0-9a-f]{64}$');

-- Entity references in audit JSON use the same conversion as entity_id.
DO $$
DECLARE k text;
BEGIN
    FOREACH k IN ARRAY ARRAY['event', 'marker'] LOOP
        UPDATE audit_log SET details = jsonb_set(details, ARRAY[k],
            to_jsonb(encode(sha256(convert_to(details->>k, 'UTF8')), 'hex')))
        WHERE details->>k ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    END LOOP;
END $$;

CREATE FUNCTION trg_hashed_id() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.id IS NULL THEN
        -- Randomness prevents enumerating keys even when the serial is known.
        NEW.id := encode(sha256(convert_to(TG_TABLE_NAME || ':' || NEW.serial_id::text
            || ':' || gen_random_uuid()::text, 'UTF8')), 'hex');
    END IF;
    RETURN NEW;
END $$;

CREATE TRIGGER reviews_participant BEFORE INSERT OR UPDATE OF event_id, volonteer_id
    ON event_reviews FOR EACH ROW EXECUTE FUNCTION trg_review_participant();

DO $$
DECLARE t text; r record;
BEGIN
    FOR r IN SELECT * FROM vt_id_foreign_keys LOOP
        EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I %s', r.tbl, r.conname, r.definition);
    END LOOP;
    FOREACH t IN ARRAY ARRAY['persons','organizations','events','volonteers',
        'volonteer_event_requests','users','event_reviews','map_markers',
        'photos','marker_closures','audit_log','email_tokens'] LOOP
        EXECUTE format('ALTER TABLE %I ENABLE TRIGGER USER', t);
        EXECUTE format('CREATE TRIGGER hashed_id BEFORE INSERT ON %I FOR EACH ROW EXECUTE FUNCTION trg_hashed_id()', t);
    END LOOP;
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'volontiers_app') THEN
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO volontiers_app;
    END IF;
END $$;
