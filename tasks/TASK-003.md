# TASK-003 — Auth и Middleware (JWT + multi-tenant)

**Приоритет:** CRITICAL  
**Сложность:** Средняя  
**Зависимости:** TASK-001, TASK-002

---

## Цель

Реализовать авторизацию через JWT и middleware для определения tenant из токена. После этой задачи все API-роуты будут защищены: клиент видит только свои данные, ops-команда видит всё.

---

## Контекст

Два типа пользователей:
- **CLIENT** — арендодатель. Логинится → получает JWT с `tenantId` → видит только своих клиентов/FAQ/диалоги
- **OPS** — ваша команда. Логинится → JWT без ограничения по tenant → видит всех клиентов

Каждый запрос к API должен проходить через `authMiddleware` (проверяет JWT) и `tenantMiddleware` (вешает `req.tenant` на запрос).

---

## Что нужно создать

### server/middleware/auth.ts

```typescript
import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthPayload {
  userId: string
  tenantId: string | null  // null для OPS
  role: 'CLIENT' | 'OPS'
}

// Расширяем тип Request чтобы нести auth payload
declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
    req.auth = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

// Middleware для роутов, доступных только OPS
export function opsOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.auth?.role !== 'OPS') {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}
```

### server/routes/auth.ts

Создать роут `POST /api/auth/login`:

**Логика:**
1. Принять `{ email, password }` из body
2. Найти пользователя в `TenantUser` по email
3. Сравнить пароль через `bcrypt.compare`
4. Если совпадает — сгенерировать JWT с `{ userId, tenantId, role }`
5. Вернуть `{ token, user: { name, email, role, tenantId } }`

**JWT payload:**
```typescript
{
  userId: user.id,
  tenantId: user.role === 'OPS' ? null : user.tenantId,
  role: user.role  // 'CLIENT' или 'OPS'
}
```

**JWT expiry:** `'30d'` (30 дней — клиент не должен перелогиниваться часто)

**Ответ при ошибке:** всегда `{ error: 'Invalid credentials' }` (не раскрывать что именно неправильно)

### server/routes/auth.ts — также добавить GET /api/auth/me

Возвращает данные текущего пользователя из JWT. Используется фронтендом при загрузке приложения.

```
GET /api/auth/me
Authorization: Bearer <token>

Response:
{
  userId, tenantId, role, name, email
}
```

### Подключить роуты в server/index.ts

```typescript
import authRoutes from './routes/auth.js'
app.use('/api/auth', authRoutes)
```

### Защитить все будущие роуты

В `server/index.ts` добавить глобальный middleware для всех `/api/` роутов кроме `/api/auth/` и `/api/health`:

```typescript
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth') || req.path === '/health') return next()
  authMiddleware(req, res, next)
})
```

---

## Создать первого OPS-пользователя (seed)

Создать файл `server/seed.ts` — скрипт для создания первого пользователя вашей команды:

```typescript
// Запускать один раз: tsx server/seed.ts
import prisma from './prisma.js'
import bcrypt from 'bcryptjs'

async function main() {
  // Создать системный tenant для OPS (нужен из-за FK, но не используется как клиент)
  const opsTenant = await prisma.tenant.upsert({
    where: { slug: 'ops-internal' },
    update: {},
    create: { name: 'Ops Team', slug: 'ops-internal', status: 'ACTIVE' }
  })

  const hash = await bcrypt.hash('changeme123', 12)
  
  await prisma.tenantUser.upsert({
    where: { tenantId_email: { tenantId: opsTenant.id, email: 'ops@avitobot.ru' } },
    update: {},
    create: {
      tenantId: opsTenant.id,
      email: 'ops@avitobot.ru',
      password: hash,
      role: 'OPS',
      name: 'Ops Admin'
    }
  })

  console.log('OPS user created: ops@avitobot.ru / changeme123')
  console.log('ВАЖНО: сменить пароль после первого входа!')
}

main().finally(() => prisma.$disconnect())
```

Добавить скрипт в `package.json`:
```json
"seed": "tsx server/seed.ts"
```

---

## Критерии приёмки

- [ ] `POST /api/auth/login` с правильными данными возвращает JWT
- [ ] `POST /api/auth/login` с неправильными данными возвращает `401`
- [ ] `GET /api/auth/me` с валидным токеном возвращает данные пользователя
- [ ] `GET /api/auth/me` без токена возвращает `401`
- [ ] `npm run seed` создаёт OPS-пользователя без ошибок
- [ ] Нет ошибок TypeScript (`npm run lint`)

---

## Что НЕ делать

- Не хранить пароли в plaintext — только bcrypt hash
- Не делать refresh token механизм (не нужно для MVP, JWT на 30 дней достаточно)
- Не делать смену пароля через API (MVP: менять вручную через Prisma Studio или seed)

---

## Коммит после выполнения

```bash
cd /Users/srt/Documents/avitobot-saas

git add server/middleware/auth.ts \
        server/routes/auth.ts \
        server/seed.ts \
        server/index.ts

git commit -m "feat: TASK-003 — JWT auth and middleware

- POST /api/auth/login returns JWT (30d expiry)
- GET /api/auth/me returns current user from token
- authMiddleware validates Bearer token on all /api routes
- opsOnly middleware restricts ops routes to OPS role
- seed.ts creates first OPS user (ops@avitobot.ru)"

git push origin master
```
