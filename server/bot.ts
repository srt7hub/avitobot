import prisma from './prisma.js'
import { getAllChats, getMessages, sendMessage, markAsRead, type TenantAvitoConfig } from './services/avitoService.js'
import { buildSystemPrompt, generateReply } from './services/aiService.js'
import { sanitizeAiResponse } from './services/responseFilter.js'
import {
  getOrCreateDialogue,
  updateDialogue,
  isMessageProcessed,
  markMessageProcessed,
  isPaused,
  pauseDialogue,
  getRecentMessages,
} from './services/memoryService.js'
import { getFaqForProperty } from './services/faqService.js'
import { sendHumanTakeoverAlert, sendDialogueNotification, sendUnknownAnswerAlert, sendOpsAlert } from './services/telegramService.js'
import type { AvitoChat, AvitoMessage } from './services/avitoService.js'
import type { TenantAvitoConfig as PrismaTenantAvitoConfig, Tenant } from '@prisma/client'

const OPERATOR_KEYWORDS = ['оператор', 'человек', 'живой', 'менеджер', 'поговорить с человеком']
const HUMAN_TAKEOVER_REPLY = 'Передаю вас менеджеру, он свяжется в ближайшее время.'
const PAUSE_MINUTES = 30

function isOperatorRequest(text: string): boolean {
  const lower = text.toLowerCase()
  return OPERATOR_KEYWORDS.some(kw => lower.includes(kw))
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

  // Deduplication
  if (await isMessageProcessed(avitoMsgId)) return

  // Get or create dialogue
  const property = await prisma.property.findFirst({
    where: { tenantId, avitoItemId: chat.item_id, isActive: true },
  })
  const dialogue = await getOrCreateDialogue(tenantId, avitoChatId, property?.id)

  // Mark guest message as processed
  await markMessageProcessed(dialogue.id, avitoMsgId, 'GUEST', msgText)
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
  }

  // Human Takeover check
  if (isOperatorRequest(msgText)) {
    await sendMessage(avitoConfig, avitoChatId, HUMAN_TAKEOVER_REPLY)

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
  if (await isPaused(avitoChatId, tenantId)) return

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
    const guestName = chat.users?.find(u => u.id !== Number(config.avitoUserId))?.name ?? 'Гость'
    const isUnknown = filteredReply.includes('Уточню и вернусь с ответом')
    if (isUnknown) {
      await sendUnknownAnswerAlert(tenant.telegramBotToken, tenant.telegramChatId, avitoChatId, guestName, msgText, filteredReply)
    } else {
      await sendDialogueNotification(tenant.telegramBotToken, tenant.telegramChatId, avitoChatId, guestName, msgText, filteredReply)
    }
  }

  console.log(`[bot][${tenantId}] Replied to chat ${avitoChatId}: "${filteredReply.slice(0, 60)}..."`)
}

async function processTenant(config: PrismaTenantAvitoConfig & { tenant: Tenant }): Promise<void> {
  const { tenantId } = config

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
        console.error(`[bot][${tenantId}] Error processing chat ${chat.id}:`, err)
      }
    }

    await prisma.botSession.upsert({
      where: { tenantId },
      update: { isRunning: true, lastPollAt: new Date() },
      create: { tenantId, isRunning: true, lastPollAt: new Date() },
    })
  } catch (err) {
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

    if (configs.length === 0) return

    console.log(`[bot] Polling ${configs.length} active tenant(s)...`)
    await Promise.allSettled(configs.map(config => processTenant(config)))
  } catch (err) {
    console.error('[bot] pollAllTenants error:', err)
  }
}

console.log('[bot] AvitoBot started, polling every 30s')
pollAllTenants()
const pollingTimer = setInterval(pollAllTenants, 30_000)

process.on('SIGTERM', async () => {
  console.log('[bot] SIGTERM received, shutting down gracefully...')
  clearInterval(pollingTimer)
  await prisma.$disconnect()
  process.exit(0)
})
