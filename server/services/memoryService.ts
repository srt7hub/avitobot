import prisma from '../prisma.js'
import type { Dialogue, Message } from '@prisma/client'

export async function getOrCreateDialogue(
  tenantId: string,
  avitoChatId: string,
  propertyId?: string
): Promise<Dialogue> {
  return prisma.dialogue.upsert({
    where: { tenantId_avitoChatId: { tenantId, avitoChatId } },
    update: {},
    create: { tenantId, avitoChatId, propertyId },
  })
}

export async function updateDialogue(
  avitoChatId: string,
  tenantId: string,
  data: Partial<Pick<Dialogue, 'guestName' | 'messageCount' | 'lastMessageAt' | 'pausedUntil' | 'greetingSent' | 'summary'>>
): Promise<void> {
  await prisma.dialogue.update({
    where: { tenantId_avitoChatId: { tenantId, avitoChatId } },
    data,
  })
}

export async function isMessageProcessed(avitoMsgId: string): Promise<boolean> {
  const msg = await prisma.message.findUnique({ where: { avitoMsgId } })
  return msg !== null
}

export async function markMessageProcessed(
  dialogueId: string,
  avitoMsgId: string,
  role: 'GUEST' | 'BOT',
  content: string
): Promise<void> {
  await prisma.message.create({
    data: { dialogueId, avitoMsgId, role, content },
  })
}

export async function isPaused(avitoChatId: string, tenantId: string): Promise<boolean> {
  const dialogue = await prisma.dialogue.findUnique({
    where: { tenantId_avitoChatId: { tenantId, avitoChatId } },
  })
  if (!dialogue?.pausedUntil) return false
  return dialogue.pausedUntil > new Date()
}

export async function pauseDialogue(avitoChatId: string, tenantId: string, minutes: number): Promise<void> {
  const pausedUntil = new Date(Date.now() + minutes * 60 * 1000)
  await prisma.dialogue.update({
    where: { tenantId_avitoChatId: { tenantId, avitoChatId } },
    data: { pausedUntil },
  })
}

export async function getRecentMessages(
  avitoChatId: string,
  tenantId: string,
  limit: number
): Promise<Message[]> {
  const dialogue = await prisma.dialogue.findUnique({
    where: { tenantId_avitoChatId: { tenantId, avitoChatId } },
  })
  if (!dialogue) return []

  return prisma.message.findMany({
    where: { dialogueId: dialogue.id },
    orderBy: { processedAt: 'desc' },
    take: limit,
  }).then(msgs => msgs.reverse())
}
