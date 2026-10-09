#!/usr/bin/env bash
# Резервная копия PostgreSQL: pg_dump в сжатом формате + удаление копий старше N дней.
# Использование: DATABASE_URL=postgres://... ./backup.sh [каталог, по умолчанию ./backups] [хранить_дней, по умолчанию 14]
# Запуск по расписанию (cron): 0 3 * * * DATABASE_URL=... /opt/volontiers/backend/scripts/backup.sh /var/backups/volontiers 14
# Копия содержит персональные данные: храните её на зашифрованном диске с ограниченным доступом.
set -euo pipefail

: "${DATABASE_URL:?задайте DATABASE_URL}"
dir="${1:-./backups}"
keep_days="${2:-14}"
mkdir -p "$dir"
chmod 700 "$dir"
file="$dir/volontiers-$(date +%Y%m%d-%H%M%S).dump"

umask 077
pg_dump --format=custom --no-owner --no-privileges --file="$file" "$DATABASE_URL"
# проверка, что архив читается
pg_restore --list "$file" > /dev/null
echo "готово: $file ($(du -h "$file" | cut -f1))"

find "$dir" -name 'volontiers-*.dump' -type f -mtime +"$keep_days" -print -delete
