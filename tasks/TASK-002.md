# TASK-002 — Схема базы данных (Prisma)

**Приоритет:** CRITICAL  
**Сложность:** Средняя  
**Зависимости:** TASK-001

---

## Цель

Создать полную схему базы данных для MVP. Схема должна поддерживать multi-tenancy (несколько клиентов), FAQ, память диалогов, управление объектами и логирование. После этой задачи `prisma db push` должен создать все таблицы без ошибок.

---

## Контекст

Это новый проект — не SmartApart. Схема упрощённая: нет бронирований, замков, ЮKassa, клинеров. Только то, что нужно AI-боту и панели управления.

Multi-tenancy реализуется через `tenantId` на каждой таблице. Один Tenant = один клиент (арендодатель), который платит за подписку.

---

## Что нужно создать

Создать файл `prisma/schema.prisma` со следующими моделями:

### Generator и Datasource (стандартные)

```prisma
generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

### Tenant — клиент (арендодатель)

```prisma
model Tenant {
  id          String       @id @default(cuid())
  name        String                           // "ИП Сидоров" или "Апарт 24"
  slug        String       @unique             // "sidorov" — для внутренней навигации
  status      TenantStatus @default(TRIAL)
  botName     String       @default("Менеджер") // Как бот представляется гостям
  createdAt   DateTime     @default(now())
  updatedAt   DateTime     @updatedAt

  users       TenantUser[]
  properties  Property[]
  faqEntries  FaqEntry[]
  avitoConfig TenantAvitoConfig?
  dialogues   Dialogue[]
  unhandled   UnhandledQuestion[]
  botSessions BotSession[]
}

enum TenantStatus {
  TRIAL
  ACTIVE
  PAUSED
  CANCELLED
}
```

### TenantUser — пользователи клиента (и ваша команда)

```prisma
model TenantUser {
  id        String   @id @default(cuid())
  tenantId  String
  email     String
  password  String                     // bcrypt hash
  role      TenantUserRole @default(CLIENT)
  name      String
  telegramContact String @default("")  // Telegram username для Human Takeover алертов
  createdAt DateTime @default(now())

  tenant    Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@unique([tenantId, email])
  @@index([tenantId])
}

enum TenantUserRole {
  CLIENT   // арендодатель — доступ только к своей панели
  OPS      // ваша команда — доступ ко всем клиентам
}
```

### TenantAvitoConfig — Авито OAuth данные клиента

```prisma
model TenantAvitoConfig {
  id               String   @id @default(cuid())
  tenantId         String   @unique
  avitoClientId    String   @default("")
  avitoClientSecret String  @default("")   // хранить зашифровано (AES) — TODO в TASK-003
  avitoUserId      String   @default("")   // ID аккаунта клиента на Авито
  accessToken      String   @default("")
  refreshToken     String   @default("")
  tokenExpiresAt   DateTime?
  lastPolledAt     DateTime?
  pollingEnabled   Boolean  @default(true)
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  tenant           Tenant   @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

### Property — объект недвижимости

```prisma
model Property {
  id          String   @id @default(cuid())
  tenantId    String
  name        String                        // "Квартира на Ленина, 45"
  address     String   @default("")
  description String   @default("")        // описание для бота: что включено, правила
  avitoItemId String   @default("")        // ID объявления на Авито (для привязки чата к объекту)
  isActive    Boolean  @default(true)
  createdAt   DateTime @default(now())
  updatedAt   DateTime @updatedAt

  tenant      Tenant      @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  faqEntries  FaqEntry[]
  dialogues   Dialogue[]

  @@index([tenantId])
  @@index([tenantId, avitoItemId])
}
```

### FaqEntry — база знаний бота

```prisma
model FaqEntry {
  id         String   @id @default(cuid())
  tenantId   String
  propertyId String?                        // null = глобальный FAQ для всех объектов
  question   String
  answer     String
  isActive   Boolean  @default(true)
  createdAt  DateTime @default(now())
  updatedAt  DateTime @updatedAt

  tenant     Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  property   Property? @relation(fields: [propertyId], references: [id], onDelete: SetNull)

  @@index([tenantId])
  @@index([tenantId, propertyId])
}
```

### UnhandledQuestion — вопросы без ответа

```prisma
model UnhandledQuestion {
  id         String    @id @default(cuid())
  tenantId   String
  question   String                       // исходный вопрос гостя
  chatId     String    @default("")       // avito chat id для контекста
  isResolved Boolean   @default(false)
  resolvedAt DateTime?
  createdAt  DateTime  @default(now())

  tenant     Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)

  @@index([tenantId, isResolved])
}
```

### Dialogue — память диалога (контекст разговора)

```prisma
model Dialogue {
  id           String    @id @default(cuid())
  tenantId     String
  propertyId   String?
  avitoChatId  String
  guestName    String    @default("")
  messageCount Int       @default(0)
  lastMessageAt DateTime?
  pausedUntil  DateTime?             // Human Takeover: AI молчит до этого времени
  greetingSent Boolean   @default(false)
  summary      String    @default("") // краткое резюме разговора для контекста
  createdAt    DateTime  @default(now())
  updatedAt    DateTime  @updatedAt

  tenant     Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  property   Property? @relation(fields: [propertyId], references: [id], onDelete: SetNull)
  messages   Message[]

  @@unique([tenantId, avitoChatId])
  @@index([tenantId])
}
```

### Message — история сообщений (для deduplication)

```prisma
model Message {
  id          String   @id @default(cuid())
  dialogueId  String
  avitoMsgId  String   @unique            // ID сообщения от Авито (для dedup)
  role        MessageRole
  content     String
  processedAt DateTime @default(now())

  dialogue    Dialogue @relation(fields: [dialogueId], references: [id], onDelete: Cascade)

  @@index([dialogueId])
  @@index([avitoMsgId])
}

enum MessageRole {
  GUEST
  BOT
}
```

### BotSession — статус бота по клиенту

```prisma
model BotSession {
  id           String    @id @default(cuid())
  tenantId     String    @unique
  isRunning    Boolean   @default(false)
  lastPollAt   DateTime?
  errorCount   Int       @default(0)
  lastError    String    @default("")
  messagesDay  Int       @default(0)      // счётчик за сегодня (сбрасывается в полночь)
  messagesWeek Int       @default(0)
  messagesMonth Int      @default(0)
  autoReplyRate Float    @default(0)      // % ответов без вмешательства оператора
  updatedAt    DateTime  @updatedAt

  tenant       Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
}
```

---

## После создания схемы

Выполнить:

```bash
npx prisma db push
npx prisma generate
```

Проверить что все таблицы созданы:

```bash
npx prisma studio
```

В Prisma Studio должны отображаться все 9 таблиц: Tenant, TenantUser, TenantAvitoConfig, Property, FaqEntry, UnhandledQuestion, Dialogue, Message, BotSession.

---

## Критерии приёмки

- [ ] `prisma db push` завершается без ошибок
- [ ] `prisma generate` завершается без ошибок
- [ ] В Prisma Studio видны все 9 таблиц
- [ ] Нет ошибок TypeScript (`npm run lint`)
- [ ] Все таблицы имеют `tenantId` (multi-tenancy готова)

---

## Что НЕ делать

- Не добавлять поля для бронирований, замков, SMS — это SmartApart, не этот продукт
- Не использовать кириллические enum'ы (в SmartApart это техдолг, здесь делаем правильно)
- Не делать `prisma migrate dev` — только `db push` на этом этапе

---

## Коммит после выполнения

```bash
cd /Users/srt/Documents/avitobot-saas

git add prisma/schema.prisma

git commit -m "feat: TASK-002 — database schema

- Tenant model with multi-tenancy support
- TenantUser with CLIENT/OPS roles
- TenantAvitoConfig for per-tenant Avito OAuth
- Property, FaqEntry, UnhandledQuestion
- Dialogue + Message (deduplication via avitoMsgId unique)
- BotSession for real-time bot status and counters"

git push origin master
```
