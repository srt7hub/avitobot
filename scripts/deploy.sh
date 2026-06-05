#!/bin/bash
set -e

echo "=== AvitoBot Deploy ==="
echo "Server: /var/www/avitobot"

# 1. Pull latest code
cd /var/www/avitobot
git pull origin master

# 2. Install dependencies
npm ci --production=false

# 3. Apply DB migrations
npx prisma db push

# 4. Regenerate Prisma client
npx prisma generate

# 5. Build frontend
npm run build

# 6. Restart PM2 (zero-downtime: reload не restart)
pm2 reload ecosystem.config.js --update-env

echo "=== Deploy complete ==="
pm2 status
