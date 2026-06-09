// Опциональная интеграция с Sentry.
// Активируется ТОЛЬКО если задан SENTRY_DSN и установлен пакет @sentry/node.
// Если чего-то из этого нет — все функции становятся no-op, запуск не ломается.
// Чтобы включить мониторинг в проде: `npm i @sentry/node` + SENTRY_DSN в .env.

type SentryLike = {
  init: (opts: Record<string, unknown>) => void
  captureException: (err: unknown, context?: Record<string, unknown>) => void
}

let sentry: SentryLike | null = null

export async function initSentry(component: string): Promise<void> {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    console.log(`[sentry] SENTRY_DSN не задан — мониторинг отключён (${component})`)
    return
  }
  try {
    // Динамический импорт: пакет может быть не установлен — это допустимо,
    // поэтому подавляем ошибку резолва типов (@sentry/node — опциональная зависимость).
    // @ts-expect-error optional dependency, resolved at runtime only when installed
    const mod = (await import('@sentry/node')) as unknown as SentryLike
    mod.init({
      dsn,
      environment: process.env.NODE_ENV || 'production',
      tracesSampleRate: 0,
      initialScope: { tags: { component } },
    })
    sentry = mod
    console.log(`[sentry] инициализирован для ${component}`)
  } catch (err) {
    console.warn(`[sentry] не удалось инициализировать (пакет @sentry/node не установлен?):`, String(err))
  }
}

export function captureError(err: unknown, context?: Record<string, unknown>): void {
  if (sentry) {
    try { sentry.captureException(err, context) } catch { /* ignore */ }
  }
}
