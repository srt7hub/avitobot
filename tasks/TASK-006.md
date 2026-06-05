# TASK-006 — API для Ops Panel (роуты вашей команды)

**Приоритет:** HIGH  
**Сложность:** Средняя  
**Зависимости:** TASK-002, TASK-003

---

## Цель

Создать REST API endpoints для внутренней панели вашей команды. Через эти роуты: создавать клиентов, настраивать Авито-авторизацию, редактировать промпты, смотреть логи и управлять подписками.

---

## Контекст

Ops Panel — это инструмент вашей команды. Доступен только с `role = OPS`.

Ключевые сценарии:
1. Создать нового клиента (онбординг)
2. Добавить Авито-конфиг для клиента
3. Посмотреть статус всех ботов
4. Управлять FAQ и промптом любого клиента
5. Перезапустить бота клиента

---

## Что нужно создать

### server/routes/ops/clients.ts

**GET /api/ops/clients**

Список всех клиентов со статусом:

```typescript
// Response:
{
  clients: [
    {
      id: string,
      name: string,
      slug: string,
      status: TenantStatus,
      bot: {
        isRunning: boolean,
        lastPollAt: string | null,
        errorCount: number,
        todayMessages: number
      },
      hasAvitoConfig: boolean,
      createdAt: string
    }
  ]
}
```

**POST /api/ops/clients** — создать нового клиента

```typescript
// Body:
{
  name: string,          // "ИП Сидоров"
  slug: string,          // "sidorov" (уникальный, только a-z, цифры, дефис)
  botName: string,       // "Менеджер" или имя (Эльза, Алина...)
  managerEmail: string,  // email для входа в панель клиента
  managerPassword: string, // временный пароль
  managerName: string,
  telegramContact: string  // @username для Human Takeover алертов
}

// Что происходит:
// 1. Создаётся Tenant
// 2. Создаётся TenantUser с role=CLIENT
// 3. Создаётся BotSession (isRunning=false)
// Response: { tenantId, message: 'Client created' }
```

**GET /api/ops/clients/:tenantId** — детальная информация о клиенте

```typescript
// Response:
{
  tenant: Tenant,
  avitoConfig: TenantAvitoConfig | null,
  properties: Property[],
  botSession: BotSession,
  recentErrors: string[],   // последние 5 ошибок из BotSession.lastError
  stats: { totalFaq, totalProperties, totalDialogues }
}
```

**PUT /api/ops/clients/:tenantId** — изменить данные клиента

```typescript
// Body: { name?, botName?, status? }
```

### server/routes/ops/avito.ts

**PUT /api/ops/clients/:tenantId/avito** — настроить Авито OAuth

```typescript
// Body:
{
  avitoClientId: string,
  avitoClientSecret: string,
  avitoUserId: string,
  refreshToken: string     // получить при OAuth авторизации вручную
}
// Создаёт или обновляет TenantAvitoConfig
// Сохраняет токены
```

**POST /api/ops/clients/:tenantId/avito/test** — протестировать подключение

```typescript
// Пытается получить список чатов через Авито API
// Response: { ok: boolean, chatCount?: number, error?: string }
```

**POST /api/ops/clients/:tenantId/bot/restart** — перезапустить polling для клиента

```typescript
// Сбрасывает errorCount, lastError
// Устанавливает pollingEnabled = true
// Response: { ok: true }
```

### server/routes/ops/content.ts

**GET /api/ops/clients/:tenantId/faq** — получить все FAQ клиента

**POST /api/ops/clients/:tenantId/faq** — добавить FAQ (от имени ops)

**PUT /api/ops/clients/:tenantId/faq/:faqId** — изменить FAQ

**DELETE /api/ops/clients/:tenantId/faq/:faqId** — удалить FAQ

**GET /api/ops/clients/:tenantId/prompt** — получить системный промпт клиента

```typescript
// Response: { prompt: string }
// Промпт хранится в Tenant.customPrompt (добавить поле в схему!)
// Если null — возвращается дефолтный промпт
```

**PUT /api/ops/clients/:tenantId/prompt** — обновить системный промпт

```typescript
// Body: { prompt: string }
// Обновляет Tenant.customPrompt
// ВАЖНО: бот использует этот промпт при следующем сообщении автоматически
```

**GET /api/ops/clients/:tenantId/properties** — список объектов клиента

**POST /api/ops/clients/:tenantId/properties** — добавить объект (с avitoItemId)

```typescript
// Body: { name, address, description, avitoItemId }
// OPS добавляет avitoItemId — это его работа, не клиента
```

**PUT /api/ops/clients/:tenantId/properties/:propertyId** — изменить объект

### server/routes/ops/logs.ts

**GET /api/ops/clients/:tenantId/dialogues** — последние диалоги клиента

```typescript
// Query: ?limit=20&offset=0
// Response: Dialogue[] с последними сообщениями
```

**GET /api/ops/clients/:tenantId/dialogues/:dialogueId/messages** — история сообщений одного чата

```typescript
// Response: Message[] в хронологическом порядке
```

**GET /api/ops/status** — общий статус всех ботов

```typescript
// Response:
{
  totalClients: number,
  runningBots: number,
  errorBots: number,      // errorCount > 0
  totalMessagesToday: number
}
```

---

## Добавить поле customPrompt в схему Tenant

В `prisma/schema.prisma` добавить в модель `Tenant`:
```prisma
customPrompt  String?   // если null — используется дефолтный промпт из aiService
```

Выполнить `prisma db push` после изменения.

---

## Подключить в server/index.ts

```typescript
import clientsRoutes from './routes/ops/clients.js'
import avitoRoutes from './routes/ops/avito.js'
import contentRoutes from './routes/ops/content.js'
import logsRoutes from './routes/ops/logs.js'

app.use('/api/ops', authMiddleware, opsOnly, clientsRoutes)
app.use('/api/ops', authMiddleware, opsOnly, avitoRoutes)
app.use('/api/ops', authMiddleware, opsOnly, contentRoutes)
app.use('/api/ops', authMiddleware, opsOnly, logsRoutes)
```

---

## Критерии приёмки

- [ ] `POST /api/ops/clients` создаёт клиента с пользователем — войти в панель под его логином
- [ ] `GET /api/ops/clients` возвращает список всех клиентов
- [ ] `PUT /api/ops/clients/:id/avito` сохраняет Авито-конфиг
- [ ] `POST /api/ops/clients/:id/avito/test` возвращает `{ ok: true }` при корректных данных
- [ ] CRUD FAQ работает для любого клиента (от имени OPS)
- [ ] `GET /api/ops/clients/:id/prompt` возвращает промпт (дефолтный если не задан)
- [ ] Роуты `/api/ops/` недоступны с CLIENT-токеном (`403`)
- [ ] Нет ошибок TypeScript (`npm run lint`)

---

## Коммит после выполнения

```bash
cd /Users/srt/Documents/avitobot-saas

git add server/routes/ops/clients.ts \
        server/routes/ops/avito.ts \
        server/routes/ops/content.ts \
        server/routes/ops/logs.ts \
        server/index.ts \
        prisma/schema.prisma

git commit -m "feat: TASK-006 — ops panel API

- GET|POST /api/ops/clients (list all, create new with user)
- GET|PUT /api/ops/clients/:id (detail, update status/name)
- PUT /api/ops/clients/:id/avito (save OAuth config)
- POST /api/ops/clients/:id/avito/test (verify connection)
- POST /api/ops/clients/:id/bot/restart
- CRUD /api/ops/clients/:id/faq and properties (with avitoItemId)
- GET|PUT /api/ops/clients/:id/prompt (custom system prompt)
- GET /api/ops/clients/:id/dialogues + messages
- GET /api/ops/status (global dashboard)
- Added customPrompt field to Tenant model"

git push origin master
```