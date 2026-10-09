#!/usr/bin/env bash
# Восстановление из копии, созданной backup.sh, в ПУСТУЮ базу.
# Использование: DATABASE_URL=postgres://owner@host/новая_база ./restore.sh файл.dump
# Рекомендуется сначала восстановить в отдельную базу и проверить (например, `cargo run -- migrate` не должен ничего менять).
set -euo pipefail

: "${DATABASE_URL:?задайте DATABASE_URL (пустая база)}"
file="${1:?укажите файл копии}"
[ -f "$file" ] || { echo "нет файла $file" >&2; exit 1; }

tables=$(psql "$DATABASE_URL" -Atc "select count(*) from information_schema.tables where table_schema = 'public'")
if [ "$tables" != "0" ]; then
  echo "база не пуста (таблиц: $tables); восстановление отменено" >&2
  exit 1
fi
pg_restore --no-owner --no-privileges --exit-on-error --dbname="$DATABASE_URL" "$file"
echo "восстановлено из $file"
psql "$DATABASE_URL" -Atc "select 'пользователей: ' || count(*) from users"
