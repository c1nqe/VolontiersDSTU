-- Минимальные права рабочей роли сервера (если роль создана через db/init-roles.sql).
-- Для локальной разработки под одним пользователем блок просто ничего не делает.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'volontiers_app') THEN
        GRANT USAGE ON SCHEMA public TO volontiers_app;
        GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO volontiers_app;
        GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO volontiers_app;
        -- журнал аудита: только чтение и добавление (плюс триггеры, запрещающие UPDATE/DELETE/TRUNCATE)
        REVOKE UPDATE, DELETE, TRUNCATE ON audit_log FROM volontiers_app;
        REVOKE TRUNCATE ON ALL TABLES IN SCHEMA public FROM volontiers_app;
    END IF;
END $$;
