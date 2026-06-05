# TASK-007 — Client Panel Frontend (веб-панель клиента)

**Приоритет:** HIGH  
**Сложность:** Средняя  
**Зависимости:** TASK-005 (API должны работать)

---

## Цель

Создать React-приложение — веб-панель для клиента (арендодателя). Простой, понятный интерфейс. Клиент заходит, видит что бот работает, управляет FAQ, редактирует объекты.

---

## Стек фронтенда

- React 19 + TypeScript
- Vite (dev server + build)
- TailwindCSS v4
- Иконки: `lucide-react`
- Состояние: встроенный `useState`/`useEffect` (без Redux/Zustand — MVP)
- HTTP-запросы: `fetch` (без axios — MVP)

---

## Структура файлов

```
src/
  main.tsx              # точка входа
  App.tsx               # роутинг: /login, /dashboard, /faq, /properties, /settings
  api.ts                # функции для вызова API (fetchDashboard, updateFaq, etc.)
  auth.ts               # хранение JWT в localStorage, функции login/logout
  client-panel/
    Login.tsx
    Dashboard.tsx
    FaqManager.tsx
    Properties.tsx
    Settings.tsx
    components/
      BotStatus.tsx     # индикатор статуса бота (зелёная/красная точка + кнопки)
      StatCard.tsx      # карточка со счётчиком (сегодня/неделя/месяц)
      DialogueList.tsx  # список последних диалогов
      FaqForm.tsx       # форма добавления/редактирования FAQ
      UnhandledList.tsx # список нерешённых вопросов
```

---

## Детали каждого экрана

### Login.tsx

Простая форма: email + password. При успехе → сохранить JWT в localStorage → редирект на /dashboard.

Показывать ошибку "Неверный email или пароль" при 401.

### App.tsx — роутинг

Использовать `window.location` или простой hash-роутинг (без react-router для MVP):

```typescript
// Простой роутинг через hash:
// /#/dashboard, /#/faq, /#/properties, /#/settings

function App() {
  const [page, setPage] = useState(getPageFromHash())
  // ...
}
```

Если JWT нет или истёк — показывать Login.

Навигация: простая боковая панель или верхнее меню с 4 пунктами.

### Dashboard.tsx

**Шапка:**
- Название компании клиента (из JWT или GET /api/auth/me)
- Кнопка "Выйти"

**Блок статуса бота:**
```
● Бот работает          [Остановить]
или
○ Бот остановлен        [Запустить]
```
Зелёная/серая точка. При клике на кнопку — вызвать `/api/client/bot/start` или `/bot/stop`.

**Три карточки счётчиков:**
```
[Сегодня: 12]   [Неделя: 67]   [30 дней: 312]
```

**Прогресс-бар автоответов:**
```
Автоответы без вас: 89%
[████████████░░]
```

**Список последних диалогов (10 штук):**
```
● Иван К. — "Добрый день, есть ли свободные..."  AI · 14:23
⚡ Мария С. — "Хочу поговорить с оператором"      Оператор · 11:47
```
Иконка ⚡ для Human Takeover диалогов.

**Баннер если есть нерешённые вопросы:**
```
⚠ 3 вопроса от гостей без ответа → [Посмотреть]
```

### FaqManager.tsx

**Верхняя панель:**
- Заголовок "База знаний бота"
- Кнопка "+ Добавить ответ"
- Фильтр по объекту (выпадающий список: "Все объекты" + каждый объект)

**Список FAQ:**

Каждая строка:
```
┌─────────────────────────────────────────────────┐
│ Есть ли парковка?                               │
│ Да, бесплатная парковка во дворе...             │
│ Все объекты                    [Изм.] [Удал.]   │
└─────────────────────────────────────────────────┘
```

При клике "Изм." — inline редактирование (превращается в textarea + кнопки Сохранить/Отмена).

При клике "Удал." — confirm диалог браузера "Удалить этот ответ?".

**Форма "+ Добавить ответ":**
Появляется сверху списка при клике кнопки:
```
Вопрос: [________________]
Ответ:  [________________]
Объект: [Все объекты ▾   ]
[Сохранить] [Отмена]
```

**Раздел "Непонятные вопросы":**

Если есть нерешённые UnhandledQuestion — показывать их отдельным блоком под FAQ:

```
Непонятные вопросы (3)
─────────────────────
"А вы принимаете безнал на карту Тинькофф?"
[Добавить ответ] [Скрыть]
```

При клике "Добавить ответ" — появляется форма с предзаполненным вопросом. После сохранения — вопрос пропадает из списка.

### Properties.tsx

**Список объектов:**

```
┌──────────────────────────────────────────────┐
│ Квартира на Ленина, 45                       │
│ ул. Ленина, 45, кв. 12                       │
│ Авито ID: 1234567890                         │
│ ● Активен                  [Редактировать]   │
└──────────────────────────────────────────────┘
```

Avito ID показывать как readonly (нельзя изменить через клиентскую панель).

**Редактирование объекта:**

Modal или inline форма:
- Название объекта
- Адрес
- Описание для бота (textarea — что бот должен знать об этом объекте: правила, особенности)
- Чекбокс "Активен"

**Кнопка "+ Добавить объект":**
Форма: название, адрес, описание. После отправки — показать сообщение:
"Заявка отправлена. Наша команда добавит объект в течение 24 часов."

### Settings.tsx

Простая форма:

```
Имя бота: [Менеджер      ]
Как бот представляется гостям

Telegram для алертов: [@username  ]
Куда приходит уведомление при запросе оператора

[Сохранить изменения]
```

---

## api.ts — HTTP-клиент

Создать вспомогательные функции. Пример паттерна:

```typescript
const BASE = '/api'

function getToken(): string | null {
  return localStorage.getItem('jwt')
}

function authHeaders(): HeadersInit {
  const token = getToken()
  return token ? { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } : {}
}

export async function fetchDashboard() {
  const res = await fetch(`${BASE}/client/dashboard`, { headers: authHeaders() })
  if (res.status === 401) { logout(); return null }
  return res.json()
}

export async function login(email: string, password: string) {
  const res = await fetch(`${BASE}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  })
  const data = await res.json()
  if (res.ok) localStorage.setItem('jwt', data.token)
  return { ok: res.ok, data }
}

export function logout() {
  localStorage.removeItem('jwt')
  window.location.hash = '/login'
}
```

---

## Дизайн-принципы

- Минимализм: только то что нужно клиенту
- Мобильная совместимость: владелец может смотреть с телефона
- Никакой анимации (Motion/Framer) — MVP, скорость важнее
- Цвета: нейтральные (серый фон, белые карточки, зелёный для "работает", красный для ошибок)
- Шрифты: системный стек (sans-serif) — не подключать Google Fonts

**Примерная цветовая схема (TailwindCSS):**
- Фон: `bg-gray-50`
- Карточки: `bg-white rounded-xl shadow-sm border border-gray-100`
- Акцент: `text-emerald-600` (активный бот), `text-gray-400` (остановлен)
- Кнопка основная: `bg-gray-900 text-white hover:bg-gray-700`
- Кнопка опасная: `text-red-500 hover:text-red-700`

---

## Критерии приёмки

- [ ] Вход через `/login` с корректными данными → попадает на дашборд
- [ ] Дашборд показывает реальные данные из API
- [ ] Кнопки Старт/Стоп меняют статус бота (проверить через Ops Panel или БД)
- [ ] CRUD FAQ работает полностью: создать, изменить, удалить
- [ ] UnhandledQuestion: "Добавить ответ" создаёт FAQ и убирает вопрос из списка
- [ ] Редактирование объекта сохраняется
- [ ] Настройки: имя бота и Telegram сохраняются
- [ ] При истёкшем токене — редирект на /login без ошибок в консоли
- [ ] Работает на мобильном (проверить в DevTools, 375px ширина)
- [ ] `npm run build` завершается без ошибок TypeScript

---

## Что НЕ делать

- Не добавлять анимации, Toast-уведомления, сложные компоненты — это MVP
- Не использовать react-router (hash-роутинг достаточно)
- Не добавлять Dark Mode
- Не делать графики/чарты (это v1)
- Не подключать внешние UI-библиотеки (MUI, Ant Design, shadcn) — только TailwindCSS

---

## Коммит после выполнения

```bash
cd /Users/srt/Documents/avitobot-saas

git add src/main.tsx \
        src/App.tsx \
        src/api.ts \
        src/auth.ts \
        src/client-panel/Login.tsx \
        src/client-panel/Dashboard.tsx \
        src/client-panel/FaqManager.tsx \
        src/client-panel/Properties.tsx \
        src/client-panel/Settings.tsx \
        src/client-panel/components/

git commit -m "feat: TASK-007 — client panel frontend

- Login screen with JWT storage in localStorage
- Dashboard: bot status toggle, message counters, recent dialogues
- FaqManager: full CRUD + UnhandledQuestion resolver
- Properties: list + inline edit (name, address, description)
- Settings: botName and telegramContact
- Hash-based routing (no react-router)
- Mobile-responsive layout (375px tested)"

git push origin master
```