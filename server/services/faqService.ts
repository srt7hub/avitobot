import prisma from '../prisma.js'
import type { FaqEntry } from '@prisma/client'

export async function getFaqForProperty(tenantId: string, propertyId?: string): Promise<FaqEntry[]> {
  return prisma.faqEntry.findMany({
    where: {
      tenantId,
      isActive: true,
      OR: [
        { propertyId: null },
        ...(propertyId ? [{ propertyId }] : []),
      ],
    },
    orderBy: { createdAt: 'asc' },
  })
}

export async function saveUnhandledQuestion(tenantId: string, question: string, chatId: string): Promise<void> {
  await prisma.unhandledQuestion.create({
    data: { tenantId, question, chatId },
  })
}
