import express from 'express'
import prisma from './prisma.js'
import { initSentry, captureError } from './sentry.js'
import { getAllChats, getMessages, sendMessage, markAsRead, AvitoApiError, type TenantAvitoConfig } from './services/avitoService.js'
import { buildSystemPrompt, generateReply } from './services/aiService.js'
import { sanitizeAiResponse } from './services/responseFilter.js'
import {
  getOrCreateDialogue,
  updateDialogue,
  markMessageProcessed,
  isPaused,
  pauseDialogue,
  getRecentMessages,
} from './services/memoryService.js'
import { getFaqForProperty } from './services/faqService.js'
import { sendHumanTakeoverAlert, sendDialogueNotification, sendUnknownAnswerAlert, sendOpsAlert } from './services/telegramService.js'
import { isPaymentStatusIntent, isSmsIntent, isAckIntent } from './constants/intents.js'
import type { AvitoChat, AvitoMessage } from './services/avitoService.js'
import type { TenantAvitoConfig as PrismaTenantAvitoConfig, Tenant } from '@prisma/client'

const OPERATOR_KEYWORDS = ['оператор', 'человек', 'живой', 'менеджер', 'поговорить с человеком']
const HUMAN_TAKEOVER_REPLY = 'Передаю вас менеджеру, он свяжется в ближайшее время.'
const PAUSE_MINUTES = 30

// Детерминированные ответы на вопросы, где LLM нельзя доверять.
// Бот НЕ знает реального статуса оплаты (нет модели Booking), поэтому даёт
// безопасный нейтральный ответ вместо выдуманного «оплата подтверждена».
const PAYMENT_STATUS_REPLY = 'Проверьте, пожалуйста, статус заявки в приложении Авито — там отображается актуальное состояние брони и оплаты.'
const SMS_REPLY = 'Уведомление придёт в ближайшее время.'
const ACK_REPLY = 'Если возникнут вопросы — пишите, всегда на связи.'

// Служебные строки, которые Авито присылает как обычный text-контент
// (удаление сообщения и т.п.). На них отвечать НЕ нужно.
const SERVICE_MESSAGE_TEXTS = [
  'сообщение удалено',
]

// Фразы в system-сообщениях Авито, означающие новую бронь/предоплату.
const BOOKING_KEYWORDS = [
  'новая бронь',
  'новая заявка',
  'создана заявка',
  'заявка на бронирование',
  'бронирование создано',
  'запрос на бронирование',
]

// Не реагируем на system-сообщения старше этого возраста (защита от того,
// что после рестарта бота старая "новая бронь" триггерит приветствие заново).
const BOOKING_MAX_AGE_MS = 2 * 60 * 60 * 1000 // 2 часа

function isSystemMessage(message: AvitoMessage): boolean {
  return message.type === 'system' || String(message.author_id) === '0'
}

function isNewBookingMessage(text: string): boolean {
  const lower = text.toLowerCase()
  return BOOKING_KEYWORDS.some(kw => lower.includes(kw))
}

function isOperatorRequest(text: string): boolean {
  const lower = text.toLowerCase()
  return OPERATOR_KEYWORDS.some(kw => lower.includes(kw))
}

// Отвечаем только на реальные текстовые сообщения гостя.
// Отсекаем: не-текстовые типы (картинки/голос/локация — у них пустой text,
// но type != text) и системные строки вроде "Сообщение удалено".
function isServiceMessage(message: AvitoMessage, text: string): boolean {
  if (message.type && message.type !== 'text') return true
  const normalized = text.trim().toLowerCase()
  return SERVICE_MESSAGE_TEXTS.includes(normalized)
}

// Отправляет детерминированный (не-AI) ответ: шлёт в Авито, помечает прочитанным,
// записывает bot-сообщение, инкрементит счётчики и уведомляет оператора в Telegram.
// Используется для перехваченных интентов (оплата/SMS/ack), где ответ программный.
async function sendProgrammaticReply(
  config: PrismaTenantAvitoConfig & { tenant: Tenant },
  avitoConfig: TenantAvitoConfig,
  dialogueId: string,
  avitoChatId: string,
  guestName: string,
  guestMessage: string,
  reply: string,
  botMsgIdPrefix: string
): Promise<void> {
  const { tenantId, tenant } = config

  await sendMessage(avitoConfig, avitoChatId, reply)
  await markAsRead(avitoConfig, avitoChatId)
  await markMessageProcessed(dialogueId, `${botMsgIdPrefix}-${Date.now()}`, 'BOT', reply)

  await prisma.botSession.upsert({
    where: { tenantId },
    update: { messagesDay: { increment: 1 }, messagesWeek: { increment: 1 }, messagesMonth: { increment: 1 }, lastPollAt: new Date(), errorCount: 0 },
    create: { tenantId, messagesDay: 1, messagesWeek: 1, messagesMonth: 1, isRunning: true },
  })

  if (tenant.telegramBotToken && tenant.telegramChatId) {
    await sendDialogueNotification(tenant.telegramBotToken, tenant.telegramChatId, avitoChatId, guestName, guestMessage, reply)
  }
}

async function processMessage(
  config: PrismaTenantAvitoConfig & { tenant: Tenant },
  chat: AvitoChat,
  message: AvitoMessage
): Promise<void> {
  const { tenantId, tenant } = config
  const avitoChatId = chat.id
  const msgText = message.content?.text ?? ''
  const avitoMsgId = String(message.id)

  if (!msgText.trim()) return

  const property = await prisma.property.findFirst({
    where: { tenantId, avitoItemId: chat.item_id, isActive: true },
  })

  // ─── Системные сообщения Авито (новая бронь / предоплата) ───────────────────
  // Обрабатываем ДО фильтра служебных сообщений и до cutoff: момент брони
  // критичен. На обычные системные строки (не бронь) — просто молчим.
  if (isSystemMessage(message)) {
    if (!isNewBookingMessage(msgText)) {
      console.log(`[bot][${tenantId}] System message (not booking) in chat ${avitoChatId}, ignoring`)
      return
    }

    const dialogue = await getOrCreateDialogue(tenantId, avitoChatId, property?.id)

    // Дедуп: помечаем системное сообщение обработанным (замок от повторов)
    const isNewSys = await markMessageProcessed(dialogue.id, avitoMsgId, 'GUEST', msgText)
    if (!isNewSys) return

    // Guard: приветствие уже отправлялось — не дублируем (рестарт/повторное обнаружение)
    if (dialogue.greetingSent) {
      console.log(`[bot][${tenantId}] New booking in chat ${avitoChatId}, but greeting already sent — skip`)
      return
    }

    // Guard по возрасту: старое system-сообщение не должно слать приветствие заново
    const ageMs = message.created ? Date.now() - message.created * 1000 : 0
    const isFresh = ageMs < BOOKING_MAX_AGE_MS

    const avitoConfig: TenantAvitoConfig = {
      id: config.id, tenantId: config.tenantId, avitoClientId: config.avitoClientId,
      avitoClientSecret: config.avitoClientSecret, avitoUserId: config.avitoUserId,
      accessToken: config.accessToken, refreshToken: config.refreshToken,
      tokenExpiresAt: config.tokenExpiresAt, pollingEnabled: config.pollingEnabled,
      pollingStartedAt: config.pollingStartedAt,
    }

    const guestFirstName = (chat.users?.find(u => u.id !== Number(config.avitoUserId))?.name ?? '').split(' ')[0]
    const greeting = guestFirstName
      ? `Здравствуйте, ${guestFirstName}! Спасибо, что выбрали нас. Для фиксации дат за вами необходимо внести предоплату через Авито.`
      : `Здравствуйте! Спасибо, что выбрали нас. Для фиксации дат за вами необходимо внести предоплату через Авито.`

    if (isFresh) {
      await sendMessage(avitoConfig, avitoChatId, greeting)
      await markAsRead(avitoConfig, avitoChatId)
      const botMsgId = `bot-booking-${Date.now()}`
      await markMessageProcessed(dialogue.id, botMsgId, 'BOT', greeting)
      await updateDialogue(avitoChatId, tenantId, { greetingSent: true, lastMessageAt: new Date() })
      console.log(`[bot][${tenantId}] New booking in chat ${avitoChatId} — greeting sent`)

      // Уведомления в Telegram клиента + OPS
      const guestName = chat.users?.find(u => u.id !== Number(config.avitoUserId))?.name ?? 'Гость'
      if (tenant.telegramBotToken && tenant.telegramChatId) {
        await sendDialogueNotification(tenant.telegramBotToken, tenant.telegramChatId, avitoChatId, guestName, '🆕 Новая бронь', greeting)
      }
      await sendOpsAlert(`[${tenantId}] Новая бронь в чате ${avitoChatId} (гость: ${guestName})`)
    } else {
      // Старое сообщение — фиксируем greetingSent чтобы не среагировать позже, без отправки
      await updateDialogue(avitoChatId, tenantId, { greetingSent: true })
      console.log(`[bot][${tenantId}] Stale booking message in chat ${avitoChatId} (age ${Math.round(ageMs / 60000)}min) — marked, no greeting`)
    }
    return
  }

  // Игнорируем служебные/не-текстовые сообщения (удаление, картинки, голос и т.п.)
  if (isServiceMessage(message, msgText)) {
    console.log(`[bot][${tenantId}] Skip service message in chat ${avitoChatId}: "${msgText.slice(0, 40)}"`)
    return
  }

  // Get or create dialogue
  const dialogue = await getOrCreateDialogue(tenantId, avitoChatId, property?.id)

  // Атомарный дедуп: попытка создать запись сообщения служит замком.
  // Если false — это сообщение уже обрабатывается/обработано, выходим.
  const isNew = await markMessageProcessed(dialogue.id, avitoMsgId, 'GUEST', msgText)
  if (!isNew) return
  await updateDialogue(avitoChatId, tenantId, {
    messageCount: dialogue.messageCount + 1,
    lastMessageAt: new Date(),
    guestName: chat.users?.find(u => u.id !== Number(config.avitoUserId))?.name ?? '',
  })

  const avitoConfig: TenantAvitoConfig = {
    id: config.id,
    tenantId: config.tenantId,
    avitoClientId: config.avitoClientId,
    avitoClientSecret: config.avitoClientSecret,
    avitoUserId: config.avitoUserId,
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    tokenExpiresAt: config.tokenExpiresAt,
    pollingEnabled: config.pollingEnabled,
    pollingStartedAt: config.pollingStartedAt,
  }

  // Предохранитель: НЕ отвечаем на сообщения, пришедшие до момента запуска
  // поллинга для этого тенанта (бэклог накопившихся непрочитанных чатов).
  // message.created — unix-время в секундах.
  const cutoff = config.pollingStartedAt
  if (cutoff && message.created && message.created * 1000 < cutoff.getTime()) {
    await markAsRead(avitoConfig, avitoChatId)
    console.log(`[bot][${tenantId}] Skip pre-cutoff message in chat ${avitoChatId} (created ${new Date(message.created * 1000).toISOString()})`)
    return
  }

  // Human Takeover check
  if (isOperatorRequest(msgText)) {
    await sendMessage(avitoConfig, avitoChatId, HUMAN_TAKEOVER_REPLY)
    await markAsRead(avitoConfig, avitoChatId)

    const botMsgId = `bot-takeover-${Date.now()}`
    await markMessageProcessed(dialogue.id, botMsgId, 'BOT', HUMAN_TAKEOVER_REPLY)
    await pauseDialogue(avitoChatId, tenantId, PAUSE_MINUTES)

    // Alert client via their own Telegram bot
    if (tenant.telegramBotToken && tenant.telegramChatId) {
      const guestName = chat.users?.find(u => u.id !== Number(config.avitoUserId))?.name ?? 'Гость'
      await sendHumanTakeoverAlert(
        tenant.telegramBotToken,
        tenant.telegramChatId,
        avitoChatId,
        guestName
      )
    }

    await prisma.botSession.upsert({
      where: { tenantId },
      update: { messagesDay: { increment: 1 }, messagesWeek: { increment: 1 }, messagesMonth: { increment: 1 }, lastPollAt: new Date() },
      create: { tenantId, messagesDay: 1, messagesWeek: 1, messagesMonth: 1, isRunning: true },
    })
    return
  }

  // Check if paused (human takeover active)
  if (await isPaused(avitoChatId, tenantId)) {
    // Помечаем прочитанным, чтобы пауза не держала чат в unread бесконечно
    await markAsRead(avitoConfig, avitoChatId)
    return
  }

  // ─── Программные интенты (перехват ДО AI) ──────────────────────────────────
  // Эти вопросы требуют детерминированного ответа: LLM на них галлюцинирует
  // (например, выдумывает «оплата подтверждена»). Отвечаем шаблоном и выходим.
  const textLower = msgText.toLowerCase()
  const guestName = chat.users?.find(u => u.id !== Number(config.avitoUserId))?.name ?? 'Гость'

  if (isPaymentStatusIntent(textLower)) {
    console.log(`[bot][${tenantId}] Payment-status intent in chat ${avitoChatId} → programmatic reply`)
    await sendProgrammaticReply(config, avitoConfig, dialogue.id, avitoChatId, guestName, msgText, PAYMENT_STATUS_REPLY, 'bot-payment')
    return
  }

  if (isSmsIntent(textLower)) {
    console.log(`[bot][${tenantId}] SMS intent in chat ${avitoChatId} → programmatic reply`)
    await sendProgrammaticReply(config, avitoConfig, dialogue.id, avitoChatId, guestName, msgText, SMS_REPLY, 'bot-sms')
    return
  }

  if (isAckIntent(textLower)) {
    console.log(`[bot][${tenantId}] Ack intent in chat ${avitoChatId} → programmatic reply`)
    await sendProgrammaticReply(config, avitoConfig, dialogue.id, avitoChatId, guestName, msgText, ACK_REPLY, 'bot-ack')
    return
  }

  // Build chat history for AI
  const recentMsgs = await getRecentMessages(avitoChatId, tenantId, 10)
  const chatHistory = recentMsgs.map(m => ({
    role: m.role === 'GUEST' ? ('user' as const) : ('assistant' as const),
    content: m.content,
  }))

  // Load FAQ
  const faqEntries = await getFaqForProperty(tenantId, property?.id)

  // Build system prompt
  const systemPrompt = buildSystemPrompt({
    botName: tenant.botName,
    property: property ? { name: property.name, address: property.address, description: property.description } : null,
    faqEntries: faqEntries.map(f => ({ question: f.question, answer: f.answer })),
    memorySummary: dialogue.summary,
  })

  // Generate AI reply
  const rawReply = await generateReply(chatHistory, systemPrompt)
  const { text: filteredReply, warnings } = sanitizeAiResponse(rawReply)

  if (warnings.length > 0) {
    console.warn(`[bot][${tenantId}] Response filter warnings for chat ${avitoChatId}:`, warnings)
  }

  // Send to Avito
  await sendMessage(avitoConfig, avitoChatId, filteredReply)
  await markAsRead(avitoConfig, avitoChatId)

  const botMsgId = `bot-${Date.now()}-${Math.random().toString(36).slice(2)}`
  await markMessageProcessed(dialogue.id, botMsgId, 'BOT', filteredReply)

  await prisma.botSession.upsert({
    where: { tenantId },
    update: { messagesDay: { increment: 1 }, messagesWeek: { increment: 1 }, messagesMonth: { increment: 1 }, lastPollAt: new Date(), errorCount: 0 },
    create: { tenantId, messagesDay: 1, messagesWeek: 1, messagesMonth: 1, isRunning: true },
  })

  // Telegram notifications
  if (tenant.telegramBotToken && tenant.telegramChatId) {
    const isUnknown = filteredReply.includes('Уточню и вернусь с ответом')
    if (isUnknown) {
      await sendUnknownAnswerAlert(tenant.telegramBotToken, tenant.telegramChatId, avitoChatId, guestName, msgText, filteredReply)
    } else {
      await sendDialogueNotification(tenant.telegramBotToken, tenant.telegramChatId, avitoChatId, guestName, msgText, filteredReply)
    }
  }

  console.log(`[bot][${tenantId}] Replied to chat ${avitoChatId}: "${filteredReply.slice(0, 60)}..."`)
}

// ─── Runtime-состояние блокировок Avito API (в памяти, per-tenant) ──────────
// 402 — тариф Авито Pro не поддерживает чтение сообщений: поллинг тенанта
// останавливается до рестарта процесса или ручного включения poll'а в панели.
// 429 — rate-limit: тенант пропускается до истечения retry-after.
const planBlockedTenants = new Set<string>()
const rateLimitedUntil = new Map<string, number>() // tenantId → timestamp (ms)

// Re-throw'им 402/429 наружу, чтобы их обработал tenant-level catch и остановил
// поллинг тенанта; остальные ошибки чата глотаем (один битый чат не валит цикл).
function isFatalAvitoError(err: unknown): err is AvitoApiError {
  return err instanceof AvitoApiError && (err.status === 402 || err.status === 429)
}

async function processTenant(config: PrismaTenantAvitoConfig & { tenant: Tenant }): Promise<void> {
  const { tenantId } = config

  // Тариф заблокирован (402) — тихо пропускаем тенант до рестарта/ре-энейбла.
  if (planBlockedTenants.has(tenantId)) return

  // Rate-limit (429) — ждём истечения retry-after.
  const blockedUntil = rateLimitedUntil.get(tenantId)
  if (blockedUntil && Date.now() < blockedUntil) return
  if (blockedUntil) rateLimitedUntil.delete(tenantId)

  // Предохранитель первого запуска: фиксируем момент старта поллинга один раз.
  // Все сообщения старше этого момента будут проигнорированы (см. processMessage).
  if (!config.pollingStartedAt) {
    const now = new Date()
    await prisma.tenantAvitoConfig.update({
      where: { tenantId },
      data: { pollingStartedAt: now },
    })
    config.pollingStartedAt = now
    console.log(`[bot][${tenantId}] First poll — cutoff set to ${now.toISOString()}, backlog will be skipped`)
  }

  const avitoConfig: TenantAvitoConfig = {
    id: config.id,
    tenantId: config.tenantId,
    avitoClientId: config.avitoClientId,
    avitoClientSecret: config.avitoClientSecret,
    avitoUserId: config.avitoUserId,
    accessToken: config.accessToken,
    refreshToken: config.refreshToken,
    tokenExpiresAt: config.tokenExpiresAt,
    pollingEnabled: config.pollingEnabled,
    pollingStartedAt: config.pollingStartedAt,
  }

  try {
    const chats = await getAllChats(avitoConfig)

    for (const chat of chats) {
      try {
        const messages = await getMessages(avitoConfig, chat.id)
        const unread = messages.filter(m => !m.isRead && m.author_id !== Number(config.avitoUserId))

        for (const message of unread) {
          await processMessage(config, chat, message)
        }
      } catch (err) {
        // 402/429 — фатально для всего тенанта: пробрасываем наружу.
        if (isFatalAvitoError(err)) throw err
        console.error(`[bot][${tenantId}] Error processing chat ${chat.id}:`, err)
      }
    }

    await prisma.botSession.upsert({
      where: { tenantId },
      update: { isRunning: true, lastPollAt: new Date(), errorCount: 0 },
      create: { tenantId, isRunning: true, lastPollAt: new Date() },
    })
  } catch (err) {
    // ─── 402: тариф Авито не поддерживает чтение сообщений ─────────────────────
    if (err instanceof AvitoApiError && err.status === 402) {
      planBlockedTenants.add(tenantId)
      console.error(`[bot][${tenantId}] ⚠️  Avito API 402 — тариф заблокирован. Поллинг тенанта остановлен.`)
      await prisma.botSession.upsert({
        where: { tenantId },
        update: { isRunning: false, lastError: 'Avito API 402: тариф Pro не поддерживает чтение сообщений' },
        create: { tenantId, isRunning: false, lastError: 'Avito API 402: тариф Pro не поддерживает чтение сообщений' },
      })
      await sendOpsAlert(`[${tenantId}] ⚠️ Avito API заблокирован (402): тариф Pro не поддерживает чтение сообщений. Автоответы остановлены до проверки тарифа.`)
      return
    }

    // ─── 429: rate-limit — пропускаем тенант до истечения retry-after ──────────
    if (err instanceof AvitoApiError && err.status === 429) {
      const retryAfterSec = err.retryAfter ?? 10
      rateLimitedUntil.set(tenantId, Date.now() + retryAfterSec * 1000)
      console.warn(`[bot][${tenantId}] Avito API 429 — rate-limited, пауза ${retryAfterSec}s`)
      return
    }

    const errorMsg = err instanceof Error ? err.message : String(err)
    console.error(`[bot][${tenantId}] Poll error:`, errorMsg)

    const session = await prisma.botSession.upsert({
      where: { tenantId },
      update: { errorCount: { increment: 1 }, lastError: errorMsg.slice(0, 500) },
      create: { tenantId, errorCount: 1, lastError: errorMsg.slice(0, 500) },
    })

    if (session.errorCount >= 5) {
      await sendOpsAlert(`[${tenantId}] Bot error count=${session.errorCount}: ${errorMsg.slice(0, 200)}`)
    }
  }
}

async function pollAllTenants(): Promise<void> {
  try {
    const configs = await prisma.tenantAvitoConfig.findMany({
      where: { pollingEnabled: true, tenant: { status: 'ACTIVE' } },
      include: { tenant: true },
    })

    // Если оператор отключил поллинг тенанта (он выпал из active-выборки), снимаем
    // его 402-блокировку: повторное включение в панели возобновит работу без рестарта.
    const activeIds = new Set(configs.map(c => c.tenantId))
    for (const blockedId of planBlockedTenants) {
      if (!activeIds.has(blockedId)) {
        planBlockedTenants.delete(blockedId)
        console.log(`[bot][${blockedId}] Поллинг был отключён оператором — снимаем 402-блокировку`)
      }
    }

    if (configs.length === 0) return

    console.log(`[bot] Polling ${configs.length} active tenant(s)...`)
    await Promise.allSettled(configs.map(config => processTenant(config)))
  } catch (err) {
    console.error('[bot] pollAllTenants error:', err)
  }
}

const POLL_INTERVAL_MS = 30_000
let isPolling = false
let stopped = false
let pollTimer: NodeJS.Timeout | null = null
// Время последнего завершённого цикла поллинга — используется /health для
// детекта «зависшего» бота (процесс online в PM2, но цикл не крутится).
let lastPollFinishedAt = Date.now()

// Самопланирующийся цикл: следующий поллинг стартует только после завершения
// текущего, что исключает наложение циклов и двойную обработку сообщений.
async function pollLoop(): Promise<void> {
  if (stopped) return
  if (isPolling) return
  isPolling = true
  try {
    await pollAllTenants()
  } catch (err) {
    console.error('[bot] pollLoop error:', err)
  } finally {
    lastPollFinishedAt = Date.now()
    isPolling = false
    if (!stopped) pollTimer = setTimeout(pollLoop, POLL_INTERVAL_MS)
  }
}

// ─── /health — лёгкий HTTP-эндпоинт для watchdog и внешнего мониторинга ──────
// Возвращает 200 если последний цикл поллинга завершился недавно, иначе 503 —
// так watchdog отличает живой бот от зависшего, а не только «процесс запущен».
function startHealthServer(): void {
  const port = Number(process.env.BOT_HEALTH_PORT) || 3011
  const app = express()
  app.get('/health', (_req, res) => {
    const ageMs = Date.now() - lastPollFinishedAt
    const stale = ageMs > POLL_INTERVAL_MS * 3 // 3 пропущенных цикла → нездоров
    res.status(stale ? 503 : 200).json({
      status: stale ? 'stale' : 'ok',
      lastPollAgoMs: ageMs,
      planBlockedTenants: planBlockedTenants.size,
    })
  })
  app.listen(port, '127.0.0.1', () => {
    console.log(`[bot] Health endpoint on http://127.0.0.1:${port}/health`)
  })
}

// ─── Глобальные обработчики необработанных ошибок ────────────────────────────
process.on('uncaughtException', (err: Error) => {
  console.error('[bot][FATAL] uncaughtException:', err)
  captureError(err, { component: 'avito-bot:uncaughtException' })
  // Выходим с ошибкой — PM2 перезапустит процесс в чистом состоянии.
  process.exit(1)
})

process.on('unhandledRejection', (reason: unknown) => {
  console.error('[bot][FATAL] unhandledRejection:', reason)
  captureError(reason instanceof Error ? reason : new Error(String(reason)), { component: 'avito-bot:unhandledRejection' })
})

async function shutdown(signal: string): Promise<void> {
  console.log(`[bot] ${signal} received, shutting down gracefully...`)
  stopped = true
  if (pollTimer) clearTimeout(pollTimer)
  await prisma.$disconnect().catch(() => {})
  process.exit(0)
}

process.on('SIGTERM', () => { shutdown('SIGTERM').catch(() => process.exit(1)) })
process.on('SIGINT', () => { shutdown('SIGINT').catch(() => process.exit(1)) })

// ─── Старт ───────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  await initSentry('avito-bot')
  startHealthServer()
  console.log('[bot] AvitoBot started, polling every 30s')
  pollLoop()
}

main().catch((err) => {
  console.error('[bot] startup error:', err)
  captureError(err, { component: 'avito-bot:startup' })
  process.exit(1)
})
