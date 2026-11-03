INSERT INTO persons (id, first_name, last_name) VALUES ('00000000-0000-0000-0000-000000000001', 'Тест', 'Миграция');
INSERT INTO organizations (id, name) VALUES ('00000000-0000-0000-0000-000000000002', 'Тестовая организация');
INSERT INTO volonteers (id, person_id, email) VALUES ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000001', 'test@example.org');
INSERT INTO users (id, person_id, email, password_hash, role) VALUES ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000001', 'test@example.org', 'unused', 'ADMIN');
INSERT INTO events (id, organization_id, title, description, location, start_at, end_at, required_volunteers, planned_hours)
VALUES ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000002', 'Тест', 'Миграция', 'ДГТУ', now(), now(), 1, 1);
UPDATE events SET status = 'ACCEPTED', cancel_requested_by = '00000000-0000-0000-0000-000000000004';
INSERT INTO volonteer_event_requests (id, volonteer_id, event_id, requested_hours)
VALUES ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000005', 1);
UPDATE volonteer_event_requests SET status = 'ACCEPTED';
UPDATE volonteer_event_requests SET status = 'CONFIRMED', confirmed_hours = 1;
INSERT INTO event_reviews (id, event_id, volonteer_id, author_name, rating, text)
VALUES ('00000000-0000-0000-0000-000000000007', '00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000003', 'Тест', 5, 'Тестовый отзыв для миграции');
INSERT INTO map_markers (id, type, title, description, lat, lng, created_by, created_by_name)
VALUES ('00000000-0000-0000-0000-000000000008', 'SEARCH_RESCUE', 'Тест', 'Миграция', 47, 39, '00000000-0000-0000-0000-000000000004', 'Тест');
INSERT INTO photos (id, marker_id, purpose, content_type, data, size_bytes, sha256, uploaded_by, moderated_by)
VALUES ('00000000-0000-0000-0000-000000000009', '00000000-0000-0000-0000-000000000008', 'MARKER', 'image/png', decode(repeat('00', 100), 'hex'), 100, repeat('a', 64), '00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000004');
INSERT INTO marker_closures (id, marker_id, photo_id, target_status, submitted_by, submitted_by_name)
VALUES ('00000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-000000000008', '00000000-0000-0000-0000-000000000009', 'FOUND', '00000000-0000-0000-0000-000000000004', 'Тест');
INSERT INTO email_tokens (id, user_id, purpose, token_hash, sent_to, expires_at)
VALUES ('00000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-000000000004', 'VERIFY_EMAIL', repeat('b', 64), 'test@example.org', now() + interval '1 hour');
INSERT INTO audit_log (actor_user_id, entity, entity_id, action, details)
VALUES ('00000000-0000-0000-0000-000000000004', 'event', '00000000-0000-0000-0000-000000000005', 'event.create', '{"event":"00000000-0000-0000-0000-000000000005"}');
