-- Роли PostgreSQL для production (выполнить один раз суперпользователем).
--   volontiers_owner — владелец схемы, применяет миграции (`volontiers-server migrate`);
--   volontiers_app   — рабочая роль сервера: только DML, без DDL, без TRUNCATE, журнал аудита — только добавление.
-- Пароли замените своими и храните в менеджере секретов.
CREATE ROLE volontiers_owner LOGIN PASSWORD 'CHANGE_ME_owner';
CREATE ROLE volontiers_app   LOGIN PASSWORD 'CHANGE_ME_app' NOSUPERUSER NOCREATEDB NOCREATEROLE;
CREATE DATABASE volontiers OWNER volontiers_owner ENCODING 'UTF8';
\connect volontiers
REVOKE ALL ON DATABASE volontiers FROM PUBLIC;
REVOKE ALL ON SCHEMA public FROM PUBLIC;
GRANT ALL ON SCHEMA public TO volontiers_owner;
GRANT USAGE ON SCHEMA public TO volontiers_app;
-- Права на таблицы выдаёт миграция 0002_app_role.sql (после создания таблиц).
