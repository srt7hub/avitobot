# TASK-001 — Инициализация проекта и структура

**Приоритет:** CRITICAL — первая задача, все остальные зависят от неё  
**Сложность:** Низкая  
**Зависимости:** Нет

---

## Цель

Создать рабочий скелет проекта: структуру папок, конфигурацию TypeScript, Prisma, PM2 и базовые `package.json` скрипты. После этой задачи проект должен запускаться командой `npm run dev` и `npm run bot`, даже если они пока ничего не делают.

---

## Что нужно сделать

### 1. Инициализировать npm-проект

```bash
cd /Users/srt/Documents/avitobot-saas
npm init -y
```

Обновить `package.json` — добавить скрипты:

```json
{
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "tsc --noEmit",
    "server": "tsx watch server/index.ts",
    "bot": "tsx watch server/bot.ts",
    "db:push": "prisma db push",
    "db:generate": "prisma generate",
    "db:migrate": "prisma migrate deploy"
  }
}
```

### 2. Установить зависимости

**Production:**
```bash
npm install express cors express-rate-limit @prisma/client jsonwebtoken bcryptjs nanoid node-cron
npm install @types/node tsx
```

**Dev:**
```bash
npm install -D typescript @types/express @types/cors @types/jsonwebtoken @types/bcryptjs prisma vite @vitejs/plugin-react react react-dom @types/react @types/react-dom tailwindcss @tailwindcss/vite
```

### 3. Создать структуру папок

```
server/
  index.ts          # заглушка: app.listen(3010)
  bot.ts            # заглушка: console.log('Bot started')
  services/         # пустая папка
  middleware/       # пустая папка
  routes/
    client/         # пустая папка
    ops/            # пустая папка
  prisma.ts         # экспортирует PrismaClient singleton
src/
  client-panel/     # пустая папка
  ops-panel/        # пустая папка
  main.tsx          # точка входа React
prisma/
  schema.prisma     # базовая схема (создать в TASK-002)
tasks/              # уже есть
```

### 4. Настроить TypeScript

Создать `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "outDir": "dist",
    "rootDir": ".",
    "paths": {}
  },
  "include": ["server/**/*"],
  "exclude": ["node_modules", "dist", "src"]
}
```

Создать `tsconfig.app.json` для фронтенда (Vite):

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx"
  },
  "include": ["src"]
}
```

### 5. Настроить Vite

Создать `vite.config.ts`:

```typescript
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 3000,
    proxy: {
      '/api': 'http://localhost:3010'
    }
  }
})
```

### 6. Создать базовые заглушки сервера

`server/prisma.ts`:
```typescript
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()
export default prisma
```

`server/index.ts`:
```typescript
import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'avitobot-api' }))

app.listen(3010, () => console.log('[api] Running on :3010'))
```

`server/bot.ts`:
```typescript
console.log('[bot] AvitoBot placeholder started')
// polling реализуется в TASK-004
```

### 7. Создать .env.example

```
DATABASE_URL=postgresql://user:password@localhost:5432/avitobot
JWT_SECRET=replace_with_random_64_char_string
REPLICATE_API_TOKEN=

# Telegram алерты для вашей команды (ops)
OPS_TELEGRAM_BOT_TOKEN=
OPS_TELEGRAM_CHAT_ID=

# Порты
API_PORT=3010
BOT_PORT=3011
```

### 8. Создать ecosystem.config.js для PM2

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
      env: { NODE_ENV: 'production' }
    },
    {
      name: 'avitobot-bot',
      script: 'server/bot.ts',
      interpreter: 'tsx',
      instances: 1,
      kill_timeout: 30000,
      env: { NODE_ENV: 'production' }
    }
  ]
}
```

### 9. Создать .gitignore

```
node_modules/
dist/
.env
.avito_token_*.json
.replied_msgs_*.json
*.log
```

---

## Критерии приёмки

- [ ] `npm run lint` завершается без ошибок
- [ ] `npm run server` запускает сервер, `GET /api/health` возвращает `{"status":"ok"}`
- [ ] `npm run bot` запускает процесс без ошибок
- [ ] `npm run dev` запускает Vite на :3000
- [ ] Структура папок соответствует README.md
- [ ] `.env.example` создан, `.env` добавлен в `.gitignore`

---

## Что НЕ делать в этой задаче

- Не писать бизнес-логику (она в TASK-003 и далее)
- Не подключать Авито API
- Не создавать React-компоненты (кроме заглушки `main.tsx`)
- Не трогать схему Prisma (это TASK-002)

---

## Коммит после выполнения

После того как все критерии приёмки пройдены — сохранить на GitHub:

```bash
cd /Users/srt/Documents/avitobot-saas

git add package.json tsconfig.json tsconfig.app.json vite.config.ts \
        ecosystem.config.js .gitignore .env.example \
        server/index.ts server/bot.ts server/prisma.ts \
        src/main.tsx

git commit -m "feat: TASK-001 — project scaffold

- npm project with dev/server/bot/lint scripts
- TypeScript config for server and frontend
- Vite config with React and TailwindCSS
- PM2 ecosystem.config.js (ports 3010/3011)
- Placeholder server/index.ts and server/bot.ts
- .env.example with all required variables"

git push origin master
```

**Проверить на GitHub:** `https://github.com/srt7hub/avitobot` — должны появиться файлы.
