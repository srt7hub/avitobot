# TASK-004 — Avito Bot: Polling + AI Pipeline

**Приоритет:** CRITICAL — это ядро продукта  
**Сложность:** Высокая  
**Зависимости:** TASK-001, TASK-002

---

## Цель

Реализовать `server/bot.ts` — процесс который каждые 30 секунд опрашивает Авито API всех активных клиентов, получает новые сообщения, генерирует ответ через AI и отправляет обратно в Авито.

Это самый важный файл проекта. Именно он создаёт ценность продукта.

---

## Контекст

В SmartApart этот код находится в `server/server.ts`. Здесь мы его переписываем с нуля с учётом multi-tenancy: бот обслуживает **всех клиентов одним процессом**. Для каждого клиента — своя Авито-авторизация, своя база FAQ, свои объекты.

**Ключевое отличие от SmartApart:**
- В SmartApart: один .env → один клиент
- Здесь: все Авито-креды в БД → N клиентов → один polling loop

---

## Файлы для создания

### server/services/avitoService.ts

Скопировать из SmartApart `server/services/avitoService.ts` и адаптировать:

**Что изменить:**
1. Убрать глобальный `tokenState` — заменить на `Map<tenantId, AvitoTokenState>`
2. Все функции принимают первым аргументом `tenantConfig: TenantAvitoConfig`
3. `loadTokenFromDisk` → `loadTokenFromDB(tenantId)` — читать из `TenantAvitoConfig`
4. `saveTokenToDisk` → `saveTokenToDB(tenantId, state)` — писать в `TenantAvitoConfig`

**Интерфейс (что должно быть публичным):**
```typescript
export async function getChats(config: TenantAvitoConfig): Promise<AvitoChat[]>
export async function getMessages(config: TenantAvitoConfig, chatId: string): Promise<AvitoMessage[]>
export async function sendMessage(config: TenantAvitoConfig, chatId: string, userId: string, text: string): Promise<void>
export async function markAsRead(config: TenantAvitoConfig, chatId: string, messageIds: string[]): Promise<void>
export async function refreshTokenIfNeeded(config: TenantAvitoConfig): Promise<TenantAvitoConfig>
```

### server/services/aiService.ts

Адаптировать из SmartApart `server/services/replicateService.ts`:

**Что упростить (убрать по сравнению с SmartApart):**
- Убрать фазы гостя (PRE_BOOKING, PAID, CHECK_IN, etc.) — в MVP бот не знает о бронированиях
- Убрать `buildPhaseSection` — нет привязки к статусу оплаты
- Убрать `isSensitiveDataAllowed` — нет doorCode/wifi в этом продукте
- Убрать `best_examples.json` — упростить для MVP

**Что оставить:**
- `buildSystemPrompt(botName, propertyContext, faqEntries, memorySection)` — главная функция
- `generateReply(messages, systemPrompt)` — вызов LLM
- Sanitize функцию для промпта

**Системный промпт — шаблон (адаптировать из SmartApart):**

```
Ты — {botName}, онлайн-менеджер по аренде квартир. Отвечаешь ТОЛЬКО на русском языке.
Пишешь тепло, живо, по-человечески. Ты НЕ являешься ИИ — никогда не признавайся что ты бот.

КРИТИЧЕСКИ ВАЖНО — ФОРМАТ ОТВЕТА:
1. Пиши ТОЛЬКО готовый ответ для гостя. Никаких размышлений, пометок, вариантов.
2. ТОЛЬКО обычный текст. ЗАПРЕЩЕНО: звёздочки **, решётки ##, списки, заголовки.
3. Длина: 1-2 коротких предложения. Максимум 150 символов.
4. НЕ СТАВЬ СМАЙЛИКИ И ЭМОДЗИ ни в каком виде.
5. НЕ ПРОЩАЙСЯ ("Всего доброго", "До свидания" — запрещено).

ГРАНИЦЫ:
Ты работаешь ТОЛЬКО по теме аренды квартир. Если вопрос НЕ связан с арендой — отвечай: "Уточню и вернусь с ответом"

ПРАВИЛА АВИТО (СТРОГО):
НЕ ПИСАТЬ: номера телефонов, email, названия мессенджеров (WhatsApp/Telegram/Viber),
ссылки на внешние сайты, предложения перейти в другой мессенджер, данные банков.
Всё общение и оплата — только через платформу Авито.

ЕСЛИ ГОСТЬ ХОЧЕТ ОПЕРАТОРА:
Если гость написал "хочу оператора", "живой человек", "позовите менеджера" — отвечай:
"Передаю вас менеджеру, он свяжется в ближайшее время."
Больше НЕ отвечай в этом чате — оператор берёт управление.

{propertyContext}
{faqSection}
{memorySection}
```

**Экспортировать:**
```typescript
export async function generateReply(
  chatHistory: { role: 'user' | 'assistant'; content: string }[],
  systemPrompt: string
): Promise<string>

export function buildSystemPrompt(params: {
  botName: string
  property: { name: string; address: string; description: string } | null
  faqEntries: { question: string; answer: string }[]
  memorySummary: string
}): string
```

### server/services/responseFilter.ts

Скопировать из SmartApart без изменений — логика фильтрации ответов не зависит от архитектуры.

### server/services/memoryService.ts

Управляет `Dialogue` и `Message` в БД:

```typescript
export async function getOrCreateDialogue(tenantId: string, avitoChatId: string, propertyId?: string): Promise<Dialogue>
export async function updateDialogue(avitoChatId: string, tenantId: string, data: Partial<...>): Promise<void>
export async function isMessageProcessed(avitoMsgId: string): Promise<boolean>
export async function markMessageProcessed(dialogueId: string, avitoMsgId: string, role: 'GUEST' | 'BOT', content: string): Promise<void>
export async function isPaused(avitoChatId: string, tenantId: string): Promise<boolean>
export async function pauseDialogue(avitoChatId: string, tenantId: string, minutes: number): Promise<void>
export async function getRecentMessages(avitoChatId: string, tenantId: string, limit: number): Promise<Message[]>
```

### server/services/faqService.ts

```typescript
export async function getFaqForProperty(tenantId: string, propertyId?: string): Promise<FaqEntry[]>
// Возвращает глобальные FAQ клиента + per-property FAQ если propertyId указан

export async function saveUnhandledQuestion(tenantId: string, question: string, chatId: string): Promise<void>
```

### server/services/telegramService.ts

Упрощённая версия из SmartApart — только два кейса:

```typescript
// Алерт клиенту при Human Takeover
export async function sendHumanTakeoverAlert(
  telegramContact: string,    // Telegram username клиента
  botToken: string,           // Bot token клиента (или общий)
  chatId: string,             // Avito chat ID
  guestName: string
): Promise<void>

// Алерт вашей команде при ошибке бота
export async function sendOpsAlert(message: string): Promise<void>
// Использует OPS_TELEGRAM_BOT_TOKEN и OPS_TELEGRAM_CHAT_ID из env
```

### server/bot.ts — главный файл бота

**Логика главного polling loop:**

```typescript
async function pollAllTenants(): Promise<void> {
  // 1. Получить всех активных клиентов с pollingEnabled = true
  const configs = await prisma.tenantAvitoConfig.findMany({
    where: { pollingEnabled: true, tenant: { status: 'ACTIVE' } },
    include: { tenant: true }
  })

  // 2. Для каждого клиента — запустить обработку параллельно
  await Promise.allSettled(configs.map(config => processTenant(config)))
}

async function processTenant(config: TenantAvitoConfig & { tenant: Tenant }): Promise<void> {
  // 3. Обновить токен если нужно
  // 4. Получить список чатов
  // 5. Для каждого чата — обработать новые сообщения
}

async function processMessage(
  config: ...,
  chat: AvitoChat,
  message: AvitoMessage
): Promise<void> {
  // 6. Проверить dedup (isMessageProcessed)
  // 7. Проверить Human Takeover (isPaused)
  // 8. Найти объект по avitoItemId чата
  // 9. Загрузить FAQ
  // 10. Построить промпт
  // 11. Сгенерировать ответ
  // 12. Отфильтровать ответ
  // 13. Отправить в Авито
  // 14. Записать в BotSession счётчики
}

// Запустить polling каждые 30 секунд
setInterval(pollAllTenants, 30_000)
pollAllTenants() // сразу при старте
```

**Human Takeover detection:**

Перед генерацией ответа проверить текст сообщения на ключевые слова:
```typescript
const OPERATOR_KEYWORDS = ['оператор', 'человек', 'живой', 'менеджер', 'поговорить с человеком']

function isOperatorRequest(text: string): boolean {
  const lower = text.toLowerCase()
  return OPERATOR_KEYWORDS.some(kw => lower.includes(kw))
}
```

Если detected:
1. Поставить `Dialogue.pausedUntil = now + 30 минут`
2. Отправить ответ: "Передаю вас менеджеру, он свяжется в ближайшее время."
3. Отправить Telegram-алерт клиенту
4. **Не генерировать** AI-ответ

**Обновление BotSession:**

После каждого успешного ответа:
```typescript
await prisma.botSession.update({
  where: { tenantId },
  data: {
    messagesDay: { increment: 1 },
    messagesWeek: { increment: 1 },
    messagesMonth: { increment: 1 },
    lastPollAt: new Date(),
    errorCount: 0
  }
})
```

При ошибке:
```typescript
await prisma.botSession.update({
  where: { tenantId },
  data: { errorCount: { increment: 1 }, lastError: err.message }
})
// Если errorCount > 5 — отправить алерт вашей команде
```

---

## Graceful Shutdown

В конце `server/bot.ts` добавить:

```typescript
process.on('SIGTERM', async () => {
  console.log('[bot] SIGTERM received, shutting down gracefully...')
  clearInterval(pollingTimer)
  await prisma.$disconnect()
  process.exit(0)
})
```

---

## Критерии приёмки

- [ ] `npm run bot` запускается без ошибок
- [ ] При наличии хотя бы одного активного клиента в БД — polling запускается каждые 30 сек (проверить по логам)
- [ ] При получении тестового сообщения в Авито — бот отвечает (проверить на тестовом аккаунте)
- [ ] Dedup работает: повторный запуск бота не отвечает на уже обработанные сообщения
- [ ] Human Takeover: написать "хочу оператора" → бот отвечает одной фразой → больше не отвечает 30 минут
- [ ] При ошибке Авито API — в логах есть описание ошибки, ops-команда получает Telegram-алерт при 5+ ошибках
- [ ] Нет ошибок TypeScript (`npm run lint`)

---

## Что НЕ делать

- Не добавлять фазы гостя (нет бронирований в этом продукте)
- Не читать Авито-токены из env — только из БД (`TenantAvitoConfig`)
- Не делать один глобальный tokenState — у каждого клиента свой
- Не писать более одного ответа на одно сообщение Авито (проверять через `isMessageProcessed`)

---

## Коммит после выполнения

```bash
cd /Users/srt/Documents/avitobot-saas

git add server/bot.ts \
        server/services/avitoService.ts \
        server/services/aiService.ts \
        server/services/responseFilter.ts \
        server/services/memoryService.ts \
        server/services/faqService.ts \
        server/services/telegramService.ts

git commit -m "feat: TASK-004 — avito bot core (AI pipeline)

- bot.ts: polling loop for all active tenants every 30s
- avitoService: per-tenant OAuth2 tokens stored in DB
- aiService: LLM prompt builder + Gemini reply generation
- responseFilter: strips phones, links, emoji, markdown
- memoryService: dialogue context and deduplication via DB
- faqService: loads global + per-property FAQ for prompt
- telegramService: human takeover alerts + ops error alerts
- Graceful SIGTERM shutdown"

git push origin master
```
