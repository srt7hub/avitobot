#!/bin/bash
# Watchdog: проверяет здоровье API и что бот реально опрашивал Авито недавно.
# При проблеме шлёт OPS-алерт в Telegram. Запускать по cron каждые 5 минут:
#   */5 * * * * /var/www/avitobot/scripts/watchdog.sh >> /var/log/avitobot/watchdog.log 2>&1
set -uo pipefail

API_URL="${API_URL:-http://localhost:3010/api/health}"
BOT_URL="${BOT_URL:-http://127.0.0.1:3011/health}"
ENV_FILE="/var/www/avitobot/.env"

if [ -f "$ENV_FILE" ]; then
  # shellcheck disable=SC2046
  export $(grep -E '^OPS_TELEGRAM_(BOT_TOKEN|CHAT_ID)=' "$ENV_FILE" | xargs)
fi

alert() {
  local msg="$1"
  echo "[watchdog] $(date) ALERT: $msg"
  if [ -n "${OPS_TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${OPS_TELEGRAM_CHAT_ID:-}" ]; then
    curl -s -m 10 -X POST \
      "https://api.telegram.org/bot${OPS_TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d "chat_id=${OPS_TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=[WATCHDOG] ${msg}" > /dev/null || true
  fi
}

# 1. Health-check API
HTTP_CODE="$(curl -s -m 10 -o /tmp/avitobot_health.json -w '%{http_code}' "$API_URL" || echo 000)"
if [ "$HTTP_CODE" != "200" ]; then
  alert "API health-check вернул HTTP ${HTTP_CODE} (${API_URL})"
  exit 1
fi

# 2. Health-check бота (детект зависшего цикла поллинга: 200 = свежий, 503 = stale)
BOT_CODE="$(curl -s -m 10 -o /tmp/avitobot_bot_health.json -w '%{http_code}' "$BOT_URL" || echo 000)"
if [ "$BOT_CODE" != "200" ]; then
  alert "Bot health-check вернул HTTP ${BOT_CODE} (${BOT_URL}) — поллинг завис или процесс не отвечает"
fi

# 3. Проверяем PM2-процессы
if command -v pm2 > /dev/null 2>&1; then
  for proc in avitobot-api avitobot-bot; do
    STATUS="$(pm2 jlist 2>/dev/null | grep -o "\"name\":\"${proc}\"[^}]*\"status\":\"[a-z]*\"" | grep -o '"status":"[a-z]*"' | cut -d'"' -f4)"
    if [ -n "$STATUS" ] && [ "$STATUS" != "online" ]; then
      alert "PM2 процесс ${proc} в статусе '${STATUS}' (ожидалось online)"
    fi
  done
fi

echo "[watchdog] $(date) OK (HTTP ${HTTP_CODE})"
