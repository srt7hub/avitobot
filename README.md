# AvitoBot SaaS — AI-бот для Авито

**Статус:** MVP в разработке  
**Дата старта:** 2026-06-05  
**Папка:** `/avitobot-saas/` — отдельный проект, независимый от SmartApart

---

## Что это

SaaS-сервис для автоматических ответов на сообщения гостей в Авито Недвижимость.

Арендодатель платит за установку + ежемесячную подписку. Мы:
- Разворачиваем бота на нашем сервере
- Подключаем Авито-аккаунт клиента (OAuth)
- Настраиваем FAQ и профиль объектов
- Даём клиенту доступ к веб-панели

Клиент в веб-панели: видит статистику, управляет FAQ, ставит на паузу.

---

## Как это работает

```
Гость пишет в Авито
      ↓
Бот получает сообщение (polling каждые 30 сек)
      ↓
Загружает FAQ и данные объекта клиента
      ↓
Генерирует ответ через LLM (Gemini Flash)
      ↓
Фильтрует: убирает телефоны, ссылки, emoji, markdown
      ↓
Отправляет ответ в Авито (< 60 сек от получения)
      ↓
Если гость написал "хочу оператора" — молчит и шлёт алерт в Telegram клиента
```

---

## Стек

| Слой | Технология |
|------|-----------|
| Backend | Express.js + TypeScript (tsx runner) |
| База данных | PostgreSQL + Prisma ORM |
| AI | Gemini Flash через Replicate API |
| Авито | Polling Messenger API (dual OAuth) |
| Уведомления | Telegram Bot |
| Фронтенд (панель) | React 19 + Vite + TailwindCSS v4 |
| Процессы | PM2 (2 процесса: API + Avito-бот) |

---

## Структура проекта

```
avitobot-saas/
  server/
    index.ts          # API-сервер (порт 3010) — CRUD для панели клиента + Ops
    bot.ts            # Avito-бот (порт 3011) — polling + AI pipeline
    services/
      avitoService.ts       # Авито API: токены, polling, отправка сообщений
      aiService.ts          # LLM: buildPrompt + generateReply
      responseFilter.ts     # Фильтр ответов: телефоны, ссылки, emoji
      telegramService.ts    # Алерты оператору + команды Human Takeover
      faqService.ts         # CRUD FAQ + UnhandledQuestions
      memoryService.ts      # Память диалога (контекст разговора)
      tenantService.ts      # Управление клиентами (создание, настройка)
    middleware/
      auth.ts               # JWT авторизация (клиент vs ops)
      tenant.ts             # Определение tenant из токена
    routes/
      client/               # Роуты для панели клиента
        dashboard.ts
        faq.ts
        properties.ts
        settings.ts
      ops/                  # Роуты для Ops панели (ваша команда)
        clients.ts
        logs.ts
        prompts.ts
  src/
    client-panel/     # Веб-панель клиента
      Dashboard.tsx
      FaqManager.tsx
      Properties.tsx
      Settings.tsx
    ops-panel/        # Панель вашей команды
      ClientsList.tsx
      ClientDetail.tsx
  prisma/
    schema.prisma     # Схема БД (tenants, properties, faq, memory...)
  tasks/              # Задачи для разработки (этот файл — точка входа)
    TASK-001.md ... TASK-010.md
  .env.example        # Переменные окружения
  ecosystem.config.js # PM2 конфигурация
```

---

## Запуск (локально)

```bash
npm ci
cp .env.example .env
# заполнить .env

npx prisma db push
npx prisma generate

# Два терминала:
npm run dev        # Vite (фронтенд) на :3000
npm run server     # Express API на :3010

# Avito-бот:
npm run bot
```

---

## Деплой на сервер

```bash
cd /var/www/avitobot
git pull
npm ci
npx prisma migrate deploy
npm run build
pm2 reload ecosystem.config.js --update-env
```

---

## Переменные окружения (см. .env.example)

| Переменная | Описание |
|-----------|---------|
| `DATABASE_URL` | PostgreSQL connection string |
| `JWT_SECRET` | Секрет для JWT токенов |
| `REPLICATE_API_TOKEN` | API ключ Replicate (для Gemini) |
| `OPS_TELEGRAM_CHAT_ID` | Telegram чат вашей команды для алертов |
| `OPS_TELEGRAM_BOT_TOKEN` | Telegram Bot Token для алертов команды |

Авито-креды хранятся в БД per-tenant (таблица `TenantAvitoConfig`), не в .env.

---

## Что взято из SmartApart

Следующие модули **скопированы и адаптированы** из SmartApart-v1.1:

- `avitoService.ts` — polling, OAuth, отправка (убрана привязка к конкретному env)
- `responseFilter.ts` — фильтрация ответов (без изменений)
- `aiService.ts` (был replicateService.ts) — LLM pipeline (упрощён: без фаз гостя)
- `telegramService.ts` — алерты (упрощён: только Human Takeover + ops-алерты)

Всё остальное написано с нуля с учётом multi-tenancy.

---

## Задачи разработки

Все задачи MVP в папке `tasks/`. Начинать с `TASK-001`.

Порядок выполнения: 001 → 002 → 003 → 004 → 005 → 006 → 007 → 008 → 009 → 010

Каждая задача — самостоятельный шаг, можно давать отдельному разработчику.
