# TASK-011 — Тестовый чат с ботом в личном кабинете клиента («Песочница»)

**Статус:** TODO
**Тип:** Feature (full-stack: backend route + frontend page)
**Приоритет:** Высокий (один из первых шагов онбординга — даёт клиенту доверие к боту до запуска)

---

## 1. Цель фичи (зачем)

Клиент в личном кабинете должен иметь возможность **напрямую пообщаться с ИИ-ботом**, как будто он гость в Авито, и увидеть, как бот отвечает — **на тех же настройках, что и в проде** (его `customPrompt`, его FAQ, данные его объекта). Это нужно, чтобы клиент протестировал бота перед запуском на реальных гостях и поправил FAQ/инструкцию, если ответы его не устраивают.

**Это «песочница»:** тестовый чат НЕ трогает реальные диалоги Авито, НЕ создаёт записей в `Dialogue`/`Message`, НЕ отправляет ничего в Авито и НЕ шлёт алерты в Telegram. Это эфемерный диалог, живущий только во фронтенде.

---

## 2. Контекст архитектуры (прочитай перед реализацией)

Проект: `avitobot-saas` — Express + TypeScript (tsx, ESM-импорты с `.js`) + Prisma/PostgreSQL, фронт React 19 + Vite + Tailwind v4. Два процесса PM2: **API-сервер** `server/index.ts` (порт 3010) и **Avito-бот** `server/bot.ts` (порт 3011). Тестовый чат реализуется **на API-сервере**, не в боте.

Ключевые факты, которые делают эту задачу простой:

- **`server/services/aiService.ts`** экспортирует две чистые функции, которые нужно переиспользовать:
  - `buildSystemPrompt({ botName, property, faqEntries, memorySummary, phase? }): string` — собирает системный промпт ровно так, как в проде. Принимает `phase?: GuestPhase` (по умолчанию `'NO_BOOKING'`). Чувствительные данные (код двери, wifi) подставляются только если `isSensitiveDataAllowed(phase)`.
  - `generateReply(chatHistory: { role: 'user' | 'assistant'; content: string }[], systemPrompt: string): Promise<string>` — вызывает Gemini Flash через Replicate, с ретраями и backoff. `role: 'user'` = гость, `role: 'assistant'` = бот.
  - Модуль импортирует ТОЛЬКО `server/utils/guestPhase.js` (чистая утилита, без Prisma), поэтому его безопасно вызывать из API-сервера. **Не дублируй логику промпта — переиспользуй эти функции.**
- **`server/utils/guestPhase.ts`** экспортирует `type GuestPhase` и `isSensitiveDataAllowed(phase)`. Значения фаз см. в файле (`NO_BOOKING`, `AWAITING_PAYMENT`, `PAID_BEFORE`, `CHECKED_IN_ACTIVE` и т.д.).
- **Монтирование клиентских роутов** (`server/index.ts`):
  ```ts
  app.use('/api/client', authMiddleware, clientOnly, faqRoutes)
  // и т.д. — dashboard, properties, settings, dialogues
  ```
  Все клиентские роуты идут под `/api/client`, защищены `authMiddleware` + `clientOnly`. В хендлере доступен `req.auth!.tenantId!` (строка) и `req.auth!.userId`.
- **Как в проде собирается контекст для ответа** (ориентир, посмотри в `server/bot.ts` / `server/services/*` как реально вызывается `buildSystemPrompt` + `generateReply`): берётся `tenant.botName`, `tenant.customPrompt`, FAQ тенанта, данные `Property`. Тестовый роут должен собрать **то же самое**.
- **Rate limit**: на API-сервере уже стоит глобальный `express-rate-limit` (см. `server/index.ts`). Эндпоинт AI дорогой — добавь отдельный, более строгий лимит на тестовый чат (см. требования ниже).
- **Фронтенд API-слой**: `src/api.ts` — все запросы клиента идут через хелперы там (с JWT из `localStorage`, ключ `jwt`, см. `src/auth.ts`). Новый вызов добавляй туда же, по образцу существующих (`fetchSettings`, `fetchFaq` и т.п.).
- **Навигация клиента**: `src/App.tsx`, тип `ClientPage` и массив `CLIENT_NAV`. Добавление новой вкладки — туда.

---

## 3. Backend — новый эндпоинт

### 3.1. Роут

Создай `server/routes/client/playground.ts` (по образцу `server/routes/client/faq.ts`). Смонтируй в `server/index.ts` рядом с остальными:
```ts
app.use('/api/client', authMiddleware, clientOnly, playgroundRoutes)
```

### 3.2. `POST /api/client/playground/reply`

**Назначение:** принять историю тестового диалога + (опционально) выбранный объект и фазу, вернуть ответ бота.

**Тело запроса:**
```ts
{
  messages: { role: 'user' | 'assistant'; content: string }[]  // вся история тестового чата, последний элемент — новое сообщение гостя (role: 'user')
  propertyId?: string   // если клиент выбрал конкретный объект; иначе берём первый активный или null
  phase?: GuestPhase    // опционально, по умолчанию 'NO_BOOKING' (см. п.5 про тест чувствительных данных)
}
```

**Логика хендлера:**
1. `tenantId = req.auth!.tenantId!`.
2. Валидация: `messages` — непустой массив, последний элемент `role === 'user'`, `content` непустой и `<= 1000` символов; всего сообщений `<= 30` (защита от раздувания промпта/стоимости). Иначе `400`.
3. Загрузить из БД:
   - `tenant` (`prisma.tenant.findUnique`) → `botName`, `customPrompt`.
   - `property`: если передан `propertyId` — `prisma.property.findFirst({ where: { id: propertyId, tenantId } })` (обязательно фильтр по `tenantId`!); иначе первый `Property` тенанта (`isActive: true`, по `createdAt`) или `null`.
   - `faqEntries`: FAQ тенанта (глобальные + привязанные к выбранному property), маппинг в `{ question, answer }`. Ориентируйся на то, как FAQ грузится в проде (`faqService` / бот).
4. Собрать системный промпт:
   ```ts
   let systemPrompt = buildSystemPrompt({
     botName: tenant.botName,
     property,           // PropertyForPrompt | null
     faqEntries,
     memorySummary: '',  // в песочнице памяти диалога нет
     phase: phase ?? 'NO_BOOKING',
   })
   ```
   **Важно:** в проде `customPrompt` тенанта тоже подмешивается в инструкцию бота. Проверь в `server/bot.ts`/`aiService`, как именно `customPrompt` добавляется к системному промпту, и воспроизведи это здесь, чтобы тест был честным. Если в проде `customPrompt` дописывается отдельной секцией — сделай так же.
5. Вызвать `const reply = await generateReply(messages, systemPrompt)`.
6. Ответ: `{ reply: string }`. На ошибку AI — `502 { error: 'AI временно недоступен, попробуйте ещё раз' }` (не роняй 500 с трейсом наружу; залогируй `console.error`).

**Запрещено в этом роуте:** любые `prisma.dialogue.*`, `prisma.message.*`, отправка в Авито (`avitoService`), отправка в Telegram (`telegramService`). Песочница ничего не персистит и наружу не ходит.

### 3.3. Rate limit

Тестовый чат дёргает дорогой AI. Навесь на `POST /playground/reply` отдельный `express-rate-limit` строже глобального, например **20 запросов в минуту на IP** (или на `req.auth.userId`, если просто). Кодом 429 + понятным сообщением.

---

## 4. Frontend — новая вкладка «Тест бота»

### 4.1. Навигация

В `src/App.tsx`:
- Добавь `'playground'` в тип `ClientPage` и в массив `CLIENT_PAGES`.
- Добавь пункт в `CLIENT_NAV`: `{ id: 'playground', label: 'Тест бота' }` — размести **сразу после «Настройки»** или перед «Диалоги» (на усмотрение, но логично рядом с настройкой).
- Отрендери `{page === 'playground' && <Playground />}` в `<main>`.

### 4.2. API-хелпер

В `src/api.ts` добавь по образцу существующих:
```ts
export async function playgroundReply(body: {
  messages: { role: 'user' | 'assistant'; content: string }[]
  propertyId?: string
  phase?: string
}): Promise<{ reply: string } | null>
```

### 4.3. Компонент `src/client-panel/Playground.tsx`

Стиль — как в существующих страницах (`src/client-panel/Settings.tsx`, `FaqManager.tsx`): Tailwind, белые карточки `rounded-xl shadow-sm border border-gray-100`, тёмная кнопка `bg-gray-900`. Соблюдай тон и плотность существующего UI.

**Экран — чат-интерфейс:**
- Заголовок `<h2>` «Тест бота» + короткое пояснение: *«Напишите боту как гость — увидите, как он ответит. Это тестовый чат: он не виден гостям и не влияет на реальные диалоги.»*
- **(Опционально, но желательно)** селектор объекта: дропдаун со списком объектов клиента (грузить через существующий `fetchListings`/`fetchProperties` из `src/api.ts` — посмотри, что уже есть). Дефолт — «Авто (первый объект)». Выбранный `propertyId` уходит в запрос. Если объектов нет — просто не показывай селектор.
- Лента сообщений: гость справа (или серым), бот слева. Хранится в локальном `useState` (`messages: {role, content}[]`), **не персистится**.
- Поле ввода + кнопка «Отправить». Enter — отправка.
- При отправке: добавить сообщение гостя в ленту → показать индикатор «бот печатает…» → вызвать `playgroundReply({ messages: [...], propertyId })` → добавить ответ бота в ленту. Блокировать ввод во время запроса.
- Кнопка «Очистить» — сбрасывает ленту в пустую.
- Обработка ошибок: при 502/429/сетевой ошибке — показать в ленте системную плашку «Не удалось получить ответ, попробуйте ещё раз» (красным), не ломая чат.

**UX-детали:**
- Пустое состояние: подсказка-плейсхолдер «Например: "Здравствуйте, квартира свободна на выходные?"».
- Не показывай системный промпт клиенту (это внутренняя кухня) — только диалог.

---

## 5. (Опционально, фаза 2 — если будет легко) Тест фаз гостя

Главная ценность движка — гейтинг чувствительных данных по фазе гостя (`buildPhaseSection` / `isSensitiveDataAllowed`). Чтобы клиент мог проверить «выдаст ли бот код двери до оплаты», добавь **переключатель фазы** над чатом:
- Дропдаун «Сценарий»: «Гость без брони» (`NO_BOOKING`), «Забронировал, не оплатил» (`AWAITING_PAYMENT`), «Оплатил, ещё не заехал» (`PAID_BEFORE`), «Заехал / проживает» (фаза, при которой `isSensitiveDataAllowed === true` — сверься с `guestPhase.ts`), «Выехал» (`POST_STAY_ACTIVE`).
- Выбранная фаза уходит в `phase` запроса.
- Так клиент наглядно видит: в фазе «не оплатил» бот код двери не даёт, а в фазе «заехал» — даёт.

Если это удлиняет задачу — вынеси в отдельный тикет, базовый чат (п.3–4) важнее.

---

## 6. Критерии приёмки

1. В кабинете клиента есть вкладка «Тест бота».
2. Клиент пишет сообщение → получает ответ ИИ в течение ~несколько секунд.
3. Ответ учитывает `customPrompt`, FAQ и данные объекта **этого** тенанта (проверить: добавить FAQ → задать соответствующий вопрос в тесте → бот отвечает по FAQ).
4. Тестовый чат **не создаёт** записей в `Dialogue`/`Message`, **не шлёт** ничего в Авито и Telegram (проверить по БД и логам).
5. Изоляция тенантов: нельзя через `propertyId` чужого тенанта подтянуть чужой объект (фильтр `tenantId` в запросе к `Property`).
6. Ошибка AI не роняет страницу — показывается понятное сообщение.
7. Rate limit срабатывает при флуде.
8. `npm run build` (фронт) и тип-чек/`tsc` проходят без ошибок; существующие тесты (`server/services/aiService.test.ts`, `server/utils/guestPhase.test.ts`) не сломаны.

---

## 7. Деплой

После реализации и проверки — задеплоить на прод-сервер (стандартный флоу проекта, `scripts/deploy.sh`). Тестовый чат завязан на `REPLICATE_API_TOKEN`, который на сервере уже задан (его использует прод-бот) — отдельной конфигурации не требует.

---

## 8. Файлы, которые затронет задача

- `server/routes/client/playground.ts` — **новый**
- `server/index.ts` — монтирование роута (+ возможно отдельный rate-limit)
- `src/api.ts` — хелпер `playgroundReply`
- `src/client-panel/Playground.tsx` — **новый**
- `src/App.tsx` — навигация/роутинг вкладки
- Переиспользовать без изменений: `server/services/aiService.ts`, `server/utils/guestPhase.ts`

**Не менять** логику `buildSystemPrompt` / `generateReply` — только вызывать.
