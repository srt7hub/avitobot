#!/bin/bash
# Запускать от root на новом сервере (первичная настройка)
set -e

# Создать директории
mkdir -p /var/www/avitobot
mkdir -p /var/log/avitobot
mkdir -p /var/backups/avitobot
cd /var/www/avitobot

# Клонировать репо (git remote уже должен быть настроен)
# git clone <repo_url> .

# Скопировать .env
cp .env.example .env
echo "ВАЖНО: заполните /var/www/avitobot/.env перед следующим шагом!"
read -p "Нажмите Enter когда .env заполнен..."

# Установить зависимости
npm ci

# Создать БД
npx prisma db push
npx prisma generate

# Создать первого OPS-пользователя
npm run seed

# Первый билд
npm run build

# Запустить через PM2
pm2 start ecosystem.config.cjs
pm2 save  # сохранить список процессов для автозапуска

# Настроить Nginx
cp nginx/avitobot.conf /etc/nginx/sites-available/avitobot.conf
ln -sf /etc/nginx/sites-available/avitobot.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

# Cron: ежедневный бэкап БД + watchdog каждые 5 минут
chmod +x scripts/backup-db.sh scripts/watchdog.sh
( crontab -l 2>/dev/null | grep -v 'avitobot/scripts/'
  echo "0 4 * * * /var/www/avitobot/scripts/backup-db.sh >> /var/log/avitobot/backup.log 2>&1"
  echo "*/5 * * * * /var/www/avitobot/scripts/watchdog.sh >> /var/log/avitobot/watchdog.log 2>&1"
) | crontab -
echo "Cron-задачи установлены (бэкап БД + watchdog)"

echo "=== Готово! ==="
echo "Панель доступна на http://$(hostname -I | awk '{print $1}')"
echo "Войдите как: ops@avitobot.ru / changeme123"
echo "СРАЗУ смените пароль через Prisma Studio!"
