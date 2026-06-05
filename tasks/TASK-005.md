# TASK-005 — API для Client Panel (роуты клиента)

**Приоритет:** HIGH  
**Сложность:** Средняя  
**Зависимости:** TASK-002, TASK-003

---

## Цель

Создать REST API endpoints, которые будет вызывать веб-панель клиента. Все роуты защищены JWT. Клиент видит только данные своего tenant.

---

## Контекст

Это серверная часть для экранов клиентской панели:
- Дашборд (статус бота, счётчики)
- FAQ Manager (CRUD)
- Объекты (список, редактирование)
- Настройки (имя бота, Telegram)

Все роуты начинаются с `/api/client/` и требуют JWT с `role = CLIENT`.

---

## Что нужно создать

### server/middleware/clientOnly.ts

```typescript
import { Request, Response, NextFunction } from 'express'

export function clientOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || (req.auth.role !== 'CLIENT' && req.auth.role !== 'OPS')) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  // OPS может действовать от имени любого клиента (для поддержки)
  next()
}
```

### server/routes/client/dashboard.ts

**GET /api/client/dashboard**

Возвращает данные для главного экрана:

```typescript
// Response:
{
  bot: {
    isRunning: boolean,
    lastPollAt: string | null,
    errorCount: number
  },
  stats: {
    today: number,       // messagesDay из BotSession
    week: number,        // messagesWeek
    month: number,       // messagesMonth
    autoReplyRate: number // autoReplyRate (%)
  },
  recentDialogues: [
    {
      id: string,
      guestName: string,
      lastMessage: string,   // первые 60 символов последнего сообщения гостя
      wasHumanTakeover: boolean,
      updatedAt: string
    }
  ],  // последние 10
  unhandledCount: number  // количество нерешённых UnhandledQuestion
}
```

**POST /api/client/bot/start** — запустить бота (установить `pollingEnabled = true`)

**POST /api/client/bot/stop** — остановить бота (`pollingEnabled = false`)

**POST /api/client/bot/pause** — пауза с датой возобновления

```typescript
// Body: { until: string (ISO date) | null }
// null = снять паузу
```

### server/routes/client/faq.ts

**GET /api/client/faq**

```typescript
// Query: ?propertyId=xxx (опционально, если не указан — все FAQ клиента)
// Response:
{
  global: FaqEntry[],     // FAQ без propertyId
  byProperty: {
    [propertyId]: FaqEntry[]
  }
}
```

**POST /api/client/faq**

```typescript
// Body:
{
  question: string,       // макс 500 символов
  answer: string,         // макс 2000 символов
  propertyId?: string     // null = глобальный
}
```

**PUT /api/client/faq/:id**

```typescript
// Body: { question?, answer?, isActive? }
// Проверять что FAQ принадлежит tenant клиента (иначе 403)
```

**DELETE /api/client/faq/:id**

Проверять что FAQ принадлежит tenant клиента.

**GET /api/client/faq/unhandled**

```typescript
// Response: UnhandledQuestion[] (isResolved = false)
```

**POST /api/client/faq/unhandled/:id/resolve**

```typescript
// Body: { answer: string }
// Создаёт FaqEntry из UnhandledQuestion
// Ставит isResolved = true на UnhandledQuestion
```

### server/routes/client/properties.ts

**GET /api/client/properties**

```typescript
// Response: Property[] для tenant клиента
```

**PUT /api/client/properties/:id**

```typescript
// Body: { name?, address?, description?, isActive? }
// Проверять принадлежность tenant
// Поля avitoItemId НЕ редактируются клиентом (только OPS)
```

**POST /api/client/properties** (упрощённый — только создание заявки)

```typescript
// Body: { name: string, address: string, description?: string }
// Создаёт Property с isActive = false
// Отправляет уведомление ops-команде в Telegram:
// "Новый объект от клиента [tenant.name]: [property.name], [address]"
// OPS сам добавит avitoItemId после проверки
```

### server/routes/client/settings.ts

**GET /api/client/settings**

```typescript
// Response:
{
  botName: string,
  telegramContact: string   // из TenantUser текущего пользователя
}
```

**PUT /api/client/settings**

```typescript
// Body: { botName?: string, telegramContact?: string }
// botName обновляет Tenant.botName
// telegramContact обновляет TenantUser.telegramContact
```

---

## Подключить все роуты в server/index.ts

```typescript
import dashboardRoutes from './routes/client/dashboard.js'
import faqRoutes from './routes/client/faq.js'
import propertiesRoutes from './routes/client/properties.js'
import settingsRoutes from './routes/client/settings.js'

app.use('/api/client', authMiddleware, clientOnly, dashboardRoutes)
app.use('/api/client', authMiddleware, clientOnly, faqRoutes)
app.use('/api/client', authMiddleware, clientOnly, propertiesRoutes)
app.use('/api/client', authMiddleware, clientOnly, settingsRoutes)
```

---

## Важные правила безопасности

В каждом роуте, который читает/пишет данные по ID:

```typescript
// Перед любой операцией проверять принадлежность tenant:
const item = await prisma.faqEntry.findFirst({
  where: { id: req.params.id, tenantId: req.auth!.tenantId! }
})
if (!item) {
  res.status(404).json({ error: 'Not found' })
  return
}
```

Никогда не делать `findUnique({ where: { id } })` без фильтра по `tenantId`. Это уязвимость — клиент мог бы получить данные другого клиента.

---

## Критерии приёмки

- [ ] `GET /api/client/dashboard` с валидным CLIENT-токеном возвращает данные
- [ ] `GET /api/client/dashboard` без токена возвращает `401`
- [ ] `GET /api/client/dashboard` с OPS-токеном возвращает `403` (OPS использует ops-роуты)
- [ ] CRUD FAQ работает: создать → получить → изменить → удалить
- [ ] UnhandledQuestion resolve: создаёт FaqEntry и помечает вопрос решённым
- [ ] Клиент не может получить FAQ другого клиента (проверить вручную с двумя разными JWT)
- [ ] `POST /api/client/bot/stop` останавливает polling для клиента
- [ ] Нет ошибок TypeScript (`npm run lint`)

---

## Коммит после выполнения

```bash
cd /Users/srt/Documents/avitobot-saas

git add server/middleware/clientOnly.ts \
        server/routes/client/dashboard.ts \
        server/routes/client/faq.ts \
        server/routes/client/properties.ts \
        server/routes/client/settings.ts \
        server/index.ts

git commit -m "feat: TASK-005 — client panel API

- GET /api/client/dashboard (stats, bot status, recent dialogues)
- POST /api/client/bot/start|stop|pause
- CRUD /api/client/faq + unhandled questions resolver
- GET|PUT /api/client/properties
- GET|PUT /api/client/settings (botName, telegramContact)
- tenantId isolation enforced on every DB query"

git push origin master
```