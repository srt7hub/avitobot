# TASK-009 — Production Config: PM2, Nginx, деплой

**Приоритет:** HIGH  
**Сложность:** Низкая  
**Зависимости:** TASK-001 (структура), TASK-004 (бот), TASK-007/008 (фронтенд)

---

## Цель

Подготовить проект к деплою на сервер: PM2 конфиг, Nginx конфиг, деплой-скрипт. После этой задачи проект можно запустить на VPS одной командой.

---

## Контекст

Сервер: Ubuntu + Nginx + PM2 + PostgreSQL (отдельный от SmartApart).

**Важно:** Этот проект работает на **других портах** чем SmartApart:
- SmartApart API: 3001, SmartApart Bot: 3002
- AvitoBot API: **3010**, AvitoBot Bot: **3011**

Это позволяет оба проекта запускать на одном VPS.

---

## Что нужно создать

### ecosystem.config.js (финальная версия)

```javascript
module.exports = {
  apps: [
    {
      name: 'avitobot-api',
      script: 'server/index.ts',
      interpreter: 'tsx',
      max_memory_restart: '512M',
      restart_delay: 3000,
      kill_timeout: 30000,
      watch: false,
      env: {
        NODE_ENV: 'production',
        API_PORT: '3010'
      }
    },
    {
      name: 'avitobot-bot',
      script: 'server/bot.ts',
      interpreter: 'tsx',
      instances: 1,        // СТРОГО 1 — иначе dedup сломается
      kill_timeout: 30000,
      watch: false,
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
}
```

### nginx/avitobot.conf

Создать файл конфигурации Nginx. На сервере скопировать в `/etc/nginx/sites-available/avitobot.conf` и сделать symlink в `sites-enabled`.

```nginx
server {
    listen 80;
    server_name avitobot.smartapartament.ru;  # поменять на реальный домен

    # Frontend (статика из dist/)
    location / {
        root /var/www/avitobot/dist;
        index index.html;
        try_files $uri $uri/ /index.html;
    }

    # API proxy
    location /api/ {
        proxy_pass http://localhost:3010;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
        
        # Не логировать X-Admin-Password в access.log
        proxy_hide_header X-Admin-Password;
    }

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN";
    add_header X-Content-Type-Options "nosniff";
    add_header Referrer-Policy "strict-origin-when-cross-origin";
}
```

После деплоя добавить HTTPS через certbot:
```bash
certbot --nginx -d avitobot.smartapartament.ru
```

### scripts/deploy.sh

Скрипт для деплоя на сервер:

```bash
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
```

Добавить в `package.json`:
```json
"deploy": "bash scripts/deploy.sh"
```

### scripts/setup-server.sh

Первичная настройка сервера (запускать один раз):

```bash
#!/bin/bash
# Запускать от root на новом сервере

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
```

### .env.example (финальная версия)

```bash
# База данных
DATABASE_URL=postgresql://avitobot:password@localhost:5432/avitobot

# JWT (сгенерировать: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_SECRET=replace_with_64_char_random_hex

# AI (Replicate API для Gemini Flash)
REPLICATE_API_TOKEN=r8_xxxxxxxxxx

# Telegram алерты для вашей команды
OPS_TELEGRAM_BOT_TOKEN=123456789:AAxxxxxx
OPS_TELEGRAM_CHAT_ID=-1001234567890

# Порты (можно не менять)
API_PORT=3010
BOT_PORT=3011

# Polling интервал в миллисекундах (default 30000 = 30 сек)
POLLING_INTERVAL_MS=30000

# Логирование (true = подробный лог чатов в консоль)
VERBOSE_CHAT_LOG=false
```

---

## Health Check endpoint

Добавить в `server/index.ts` расширенный health check:

```typescript
app.get('/api/health', async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    const activeBots = await prisma.botSession.count({ where: { isRunning: true } })
    res.json({
      status: 'ok',
      service: 'avitobot-api',
      db: 'connected',
      activeBots,
      uptime: process.uptime()
    })
  } catch (err) {
    res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})
```

---

## Rate Limiting

Добавить в `server/index.ts` перед всеми роутами:

```typescript
import rateLimit from 'express-rate-limit'

app.use(rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' }
}))
```

---

## Критерии приёмки

- [ ] `pm2 start ecosystem.config.js` запускает оба процесса без ошибок
- [ ] `pm2 status` показывает `avitobot-api` и `avitobot-bot` в статусе `online`
- [ ] `curl http://localhost:3010/api/health` возвращает `{"status":"ok",...}`
- [ ] После `npm run build` папка `dist/` содержит `index.html`
- [ ] Nginx конфиг проходит `nginx -t` без ошибок
- [ ] `pm2 reload ecosystem.config.js` не прерывает работу (zero-downtime)
- [ ] `pm2 save` + перезагрузка сервера → PM2 автоматически поднимает процессы

---

## Что НЕ делать

- Не использовать `pm2 restart` для деплоя — только `pm2 reload` (zero-downtime)
- Не хранить .env в git репозитории
- Не запускать на тех же портах что SmartApart (3001/3002)
- Не делать Kubernetes или Docker на этом этапе

---

## Коммит после выполнения

```bash
cd /Users/srt/Documents/avitobot-saas

git add ecosystem.config.js \
        nginx/avitobot.conf \
        scripts/deploy.sh \
        scripts/setup-server.sh \
        .env.example \
        server/index.ts

git commit -m "feat: TASK-009 — production config

- PM2 ecosystem.config.js (ports 3010/3011, graceful shutdown)
- Nginx config: static frontend + /api proxy + security headers
- scripts/deploy.sh: pull → npm ci → db push → build → pm2 reload
- scripts/setup-server.sh: first-time server setup
- Enhanced /api/health with DB check and activeBots count
- Rate limiting: 200 req/min per IP"

git push origin master
```