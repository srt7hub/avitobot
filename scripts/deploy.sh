#!/bin/bash
set -e

echo "=== AvitoBot Deploy ==="
echo "Server: /var/www/avitobot"

# 0. Директории для логов/бэкапов (нужны для ecosystem.config.cjs)
mkdir -p /var/log/avitobot /var/backups/avitobot

# 1. Pull latest code
cd /var/www/avitobot
git pull origin main

# 2. Install dependencies
npm ci --production=false

# 3. Apply DB migrations
npx prisma db push

# 4. Regenerate Prisma client
npx prisma generate

# 5. Build frontend
npm run build

# 6. Restart PM2 (zero-downtime: reload не restart)
pm2 reload ecosystem.config.cjs --update-env

echo "=== Deploy complete ==="
pm2 status
