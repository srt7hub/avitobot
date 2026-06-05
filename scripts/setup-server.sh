#!/bin/bash
# Запускать от root на новом сервере (первичная настройка)
set -e

# Создать директорию
mkdir -p /var/www/avitobot
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
pm2 start ecosystem.config.js
pm2 save  # сохранить список процессов для автозапуска

# Настроить Nginx
cp nginx/avitobot.conf /etc/nginx/sites-available/avitobot.conf
ln -sf /etc/nginx/sites-available/avitobot.conf /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx

echo "=== Готово! ==="
echo "Панель доступна на http://$(hostname -I | awk '{print $1}')"
echo "Войдите как: ops@avitobot.ru / changeme123"
echo "СРАЗУ смените пароль через Prisma Studio!"
