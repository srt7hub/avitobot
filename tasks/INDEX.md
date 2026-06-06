# AvitoBot MVP — Индекс задач

**Порядок выполнения строгий:** каждая задача зависит от предыдущих.

---

## Дорожная карта MVP

```
TASK-001 → TASK-002 → TASK-003 → TASK-004
                                     ↓
              TASK-005 ←→ TASK-006
                ↓               ↓
            TASK-007        TASK-008
                ↓               ↓
              TASK-009 (деплой)
                    ↓
              TASK-010 (тест)
```

---

## Список задач

| # | Задача | Что делает | Сложность | Статус |
|---|--------|-----------|-----------|--------|
| [TASK-001](TASK-001.md) | Инициализация проекта | npm, TypeScript, Vite, структура папок | Низкая | ☐ |
| [TASK-002](TASK-002.md) | Схема БД (Prisma) | Все таблицы: Tenant, FAQ, Dialogue, Message... | Средняя | ☐ |
| [TASK-003](TASK-003.md) | Auth и Middleware | JWT, login endpoint, OPS/CLIENT роли | Средняя | ☐ |
| [TASK-004](TASK-004.md) | Avito Bot (ядро) | Polling, AI pipeline, Human Takeover, dedup | Высокая | ☐ |
| [TASK-005](TASK-005.md) | API Client Panel | Роуты для клиентской веб-панели | Средняя | ☐ |
| [TASK-006](TASK-006.md) | API Ops Panel | Роуты для внутренней панели команды | Средняя | ☐ |
| [TASK-007](TASK-007.md) | Client Panel Frontend | React-панель для арендодателя | Средняя | ☐ |
| [TASK-008](TASK-008.md) | Ops Panel Frontend | React-панель для вашей команды | Средняя | ☐ |
| [TASK-009](TASK-009.md) | Production Config | PM2, Nginx, деплой-скрипт | Низкая | ☐ |
| [TASK-010](TASK-010.md) | E2E тест + чеклист | Полное тестирование перед первым клиентом | Низкая | ☐ |

---

## Сервер

| Параметр | Значение |
|----------|----------|
| IP | `72.56.1.39` |
| Пользователь | `root` |
| Пароль | `12345678qwerty` |
| Путь на сервере | `/var/www/avitobot` |
| SSH | `ssh root@72.56.1.39` |
| Деплой | `bash /var/www/avitobot/scripts/deploy.sh` |

---

## Git-стратегия

Репозиторий: `https://github.com/srt7hub/avitobot`  
Ветка: `main`

**Правило:** каждая задача = один коммит с осмысленным сообщением.  
В конце каждого TASK-файла есть точные git-команды — копировать и выполнять.

**Итоговая история коммитов будет выглядеть так:**

```
v0.1.0-mvp   ← тег MVP (после TASK-010)
│
● docs: TASK-010 — MVP launch report
● feat: TASK-009 — production config
● feat: TASK-008 — ops panel frontend
● feat: TASK-007 — client panel frontend
● feat: TASK-006 — ops panel API
● feat: TASK-005 — client panel API
● feat: TASK-004 — avito bot core (AI pipeline)
● feat: TASK-003 — JWT auth and middleware
● feat: TASK-002 — database schema
● feat: TASK-001 — project scaffold
● docs: initial project documentation
```

Любой разработчик в любой момент может:
1. Клонировать репо: `git clone https://github.com/srt7hub/avitobot.git`
2. Понять где что: открыть `README.md`
3. Найти следующую незакрытую задачу в этом файле (INDEX.md)
4. Открыть соответствующий TASK-XXX.md и приступить

---

## Что взять из SmartApart (не писать с нуля)

| Файл | Откуда взять | Что изменить |
|------|-------------|-------------|
| `avitoService.ts` | SmartApart/server/services/ | Убрать глобальный tokenState → Map по tenantId |
| `responseFilter.ts` | SmartApart/server/services/ | Без изменений |
| `aiService.ts` | SmartApart/server/services/replicateService.ts | Убрать фазы гостя (PRE_BOOKING и т.д.) |
| `telegramService.ts` | SmartApart/server/services/ | Оставить только Human Takeover + ops-алерты |

---

## Оценка времени

| Задача | Оценка |
|--------|--------|
| TASK-001 | 2-3 часа |
| TASK-002 | 2-3 часа |
| TASK-003 | 3-4 часа |
| TASK-004 | 1-2 дня |
| TASK-005 | 1 день |
| TASK-006 | 1 день |
| TASK-007 | 2-3 дня |
| TASK-008 | 1-2 дня |
| TASK-009 | 2-3 часа |
| TASK-010 | 1 день |
| **Итого MVP** | **~2 недели** |

---

## Что НЕ входит в MVP (будет в V1)

- Аналитика и графики (диаграммы использования)
- Еженедельный Telegram-дайджест
- Биллинг и оплата в панели
- История диалогов с поиском
- Смена пароля через интерфейс
- Onboarding wizard для клиента