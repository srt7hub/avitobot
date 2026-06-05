# AvitoBot MVP — Launch Report

**Дата:** 2026-06-05  
**Версия:** v0.1.0-mvp  
**Статус:** Готов к первому клиенту

---

## E2E Сценарии

| # | Сценарий | Статус |
|---|---------|--------|
| 1 | Полный онбординг нового клиента | ✅ Пройден |
| 2 | Управление FAQ клиентом (CRUD) | ✅ Пройден |
| 3 | Старт/стоп бота | ✅ Пройден |
| 4 | Human Takeover | ⏳ После подключения реального Авито |
| 5 | Изоляция клиентов (403 на чужие данные) | ✅ Пройден |
| 6 | Health Check и мониторинг | ✅ Пройден |

---

## Технический чеклист

### Сборка и типы
- [x] `npm run build` — без ошибок (TypeScript + Vite)
- [x] `npx tsc --noEmit` — 0 ошибок
- [x] `dist/index.html` существует после build

### API и безопасность
- [x] `/api/health` возвращает `{status:"ok", db:"connected", activeBots, uptime}`
- [x] JWT авторизация: CLIENT не может вызвать `/api/ops/*` → 403
- [x] Изоляция tenant: `/api/client/faq` возвращает только свои данные
- [x] Rate limiting: 200 req/min (express-rate-limit)
- [x] Дедупликация сообщений в боте (processedIds в памяти)

### Frontend
- [x] Login: JWT сохраняется в localStorage, редирект на /dashboard
- [x] Role-based routing: OPS → Ops Panel, CLIENT → Client Panel
- [x] Истёкший токен → автоматический редирект на /login
- [x] Client Panel: Dashboard / FAQ / Properties / Settings
- [x] Ops Panel: ClientsList / ClientCreate / ClientDetail (4 вкладки)
- [x] Мобильная совместимость (max-w-2xl, responsive)

### PM2 и деплой
- [x] `ecosystem.config.js`: 2 процесса на портах 3010/3011
- [x] `scripts/deploy.sh`: pull → ci → db push → build → pm2 reload
- [x] `scripts/setup-server.sh`: первичная настройка VPS
- [x] Nginx конфиг: статика + proxy /api/ + security headers

---

## Операционный чеклист (перед деплоем на сервер)

### Сервер
- [ ] `.env` заполнен: DATABASE_URL, JWT_SECRET, REPLICATE_API_TOKEN
- [ ] `OPS_TELEGRAM_BOT_TOKEN` + `OPS_TELEGRAM_CHAT_ID` настроены
- [ ] `npm run seed` выполнен, OPS-пароль сменён
- [ ] `pm2 start ecosystem.config.js && pm2 save` выполнен
- [ ] Nginx запущен, `/api/health` доступен по домену
- [ ] HTTPS через certbot настроен
- [ ] PostgreSQL backup через cron настроен

### Первый клиент
- [ ] Авито OAuth данные получены и сохранены через Ops Panel
- [ ] Тест подключения Авито прошёл (`chatCount > 0`)
- [ ] Минимум 5 FAQ добавлены
- [ ] Объект с правильным Avito Item ID добавлен
- [ ] Telegram клиента настроен для Human Takeover алертов
- [ ] Клиент залогинился в Client Panel и знает как управлять FAQ
- [ ] Тестовое сообщение в Авито → бот ответил корректно
- [ ] Клиент одобрил тон и содержание ответа

---

## Что найдено и исправлено

| Проблема | Исправление |
|---------|------------|
| `index.html` отсутствовал — Vite не мог собрать | Создан `index.html` в корне (TASK-007) |
| `src/index.css` отсутствовал — TailwindCSS не загружался | Создан с `@import "tailwindcss"` (TASK-007) |

---

## Архитектура MVP

```
Авито Messenger API
      ↓ polling каждые 30 сек (bot.ts :3011)
BotSession per tenant
      ↓
AI Pipeline: FAQ + промпт → Gemini Flash (Replicate)
      ↓
responseFilter: убрать тел./ссылки/emoji
      ↓
Отправить ответ | Human Takeover → Telegram алерт
```

```
Браузер (React 19 + TailwindCSS v4)
      ↓ fetch /api/*
Express API (index.ts :3010)
      ↓ JWT authMiddleware
Prisma ORM → PostgreSQL
```

---

## Состав релиза v0.1.0-mvp

| TASK | Что сделано |
|------|------------|
| TASK-001 | Инициализация: npm, TypeScript, Vite, структура |
| TASK-002 | Prisma схема: Tenant, FAQ, Dialogue, Message, BotSession |
| TASK-003 | JWT auth, middleware OPS/CLIENT |
| TASK-004 | Avito bot: polling, AI pipeline, Human Takeover, dedup |
| TASK-005 | Client Panel API: dashboard, faq, properties, settings |
| TASK-006 | Ops Panel API: clients, avito config, content, logs |
| TASK-007 | Client Panel Frontend: Login, Dashboard, FAQ, Properties, Settings |
| TASK-008 | Ops Panel Frontend: ClientsList, ClientCreate, ClientDetail (4 вкладки) |
| TASK-009 | Production: PM2, Nginx, deploy scripts, rate limiting, health check |
| TASK-010 | E2E тест, чеклист, launch report |

**Итого:** 10 задач, ~2600 строк кода, ~2 недели разработки (план)
