import { Router } from 'express'
import prisma from '../../prisma.js'

const router = Router()

router.get('/faq', async (req, res) => {
  const tenantId = req.auth!.tenantId!

  try {
    const entries = await prisma.faqEntry.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })

    const global = entries.filter(e => e.propertyId === null)
    const byProperty: Record<string, typeof entries> = {}
    for (const e of entries.filter(e => e.propertyId !== null)) {
      const key = e.propertyId!
      if (!byProperty[key]) byProperty[key] = []
      byProperty[key].push(e)
    }

    res.json({ global, byProperty })
  } catch (err) {
    console.error('[faq GET] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/faq', async (req, res) => {
  const tenantId = req.auth!.tenantId!
  const { question, answer, propertyId } = req.body as {
    question?: string
    answer?: string
    propertyId?: string
  }

  if (!question?.trim() || !answer?.trim()) {
    res.status(400).json({ error: 'question and answer are required' })
    return
  }
  if (question.length > 500) {
    res.status(400).json({ error: 'question too long (max 500)' })
    return
  }
  if (answer.length > 2000) {
    res.status(400).json({ error: 'answer too long (max 2000)' })
    return
  }

  // Verify propertyId belongs to this tenant
  if (propertyId) {
    const prop = await prisma.property.findFirst({ where: { id: propertyId, tenantId } })
    if (!prop) {
      res.status(404).json({ error: 'Property not found' })
      return
    }
  }

  try {
    const entry = await prisma.faqEntry.create({
      data: { tenantId, question: question.trim(), answer: answer.trim(), propertyId: propertyId ?? null },
    })
    res.status(201).json(entry)
  } catch (err) {
    console.error('[faq POST] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/faq/:id', async (req, res) => {
  const tenantId = req.auth!.tenantId!
  const { id } = req.params
  const { question, answer, isActive } = req.body as {
    question?: string
    answer?: string
    isActive?: boolean
  }

  const entry = await prisma.faqEntry.findFirst({ where: { id, tenantId } })
  if (!entry) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    const updated = await prisma.faqEntry.update({
      where: { id },
      data: {
        ...(question !== undefined && { question: question.trim() }),
        ...(answer !== undefined && { answer: answer.trim() }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    res.json(updated)
  } catch (err) {
    console.error('[faq PUT] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/faq/:id', async (req, res) => {
  const tenantId = req.auth!.tenantId!
  const { id } = req.params

  const entry = await prisma.faqEntry.findFirst({ where: { id, tenantId } })
  if (!entry) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    await prisma.faqEntry.delete({ where: { id } })
    res.json({ ok: true })
  } catch (err) {
    console.error('[faq DELETE] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/faq/unhandled', async (req, res) => {
  const tenantId = req.auth!.tenantId!

  try {
    const questions = await prisma.unhandledQuestion.findMany({
      where: { tenantId, isResolved: false },
      orderBy: { createdAt: 'desc' },
    })
    res.json(questions)
  } catch (err) {
    console.error('[faq/unhandled GET] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/faq/unhandled/:id/resolve', async (req, res) => {
  const tenantId = req.auth!.tenantId!
  const { id } = req.params
  const { answer } = req.body as { answer?: string }

  if (!answer?.trim()) {
    res.status(400).json({ error: 'answer is required' })
    return
  }

  const question = await prisma.unhandledQuestion.findFirst({ where: { id, tenantId } })
  if (!question) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    const [faqEntry] = await prisma.$transaction([
      prisma.faqEntry.create({
        data: { tenantId, question: question.question, answer: answer.trim() },
      }),
      prisma.unhandledQuestion.update({
        where: { id },
        data: { isResolved: true, resolvedAt: new Date() },
      }),
    ])
    res.status(201).json(faqEntry)
  } catch (err) {
    console.error('[faq/unhandled resolve] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
