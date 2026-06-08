#!/bin/bash
# Бэкап PostgreSQL с ротацией. Запускать по cron, например ежедневно в 4:00:
#   0 4 * * * /var/www/avitobot/scripts/backup-db.sh >> /var/log/avitobot/backup.log 2>&1
set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-/var/backups/avitobot}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"

# DATABASE_URL берём из .env проекта
ENV_FILE="/var/www/avitobot/.env"
if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^DATABASE_URL=' "$ENV_FILE" | xargs)
fi

if [ -z "${DATABASE_URL:-}" ]; then
  echo "[backup] ERROR: DATABASE_URL не задан" >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"
OUT="$BACKUP_DIR/avitobot_${TIMESTAMP}.sql.gz"

echo "[backup] $(date) — dumping to $OUT"
# pg_dump понимает connection URI напрямую
pg_dump "$DATABASE_URL" | gzip > "$OUT"

# Проверяем, что файл не пустой
if [ ! -s "$OUT" ]; then
  echo "[backup] ERROR: дамп пустой, удаляю $OUT" >&2
  rm -f "$OUT"
  exit 1
fi

echo "[backup] OK — $(du -h "$OUT" | cut -f1)"

# Ротация: удаляем бэкапы старше RETENTION_DAYS
find "$BACKUP_DIR" -name 'avitobot_*.sql.gz' -mtime "+${RETENTION_DAYS}" -delete
echo "[backup] ротация: оставлены бэкапы за последние ${RETENTION_DAYS} дн."
