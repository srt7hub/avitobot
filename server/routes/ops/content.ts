import { Router } from 'express'
import prisma from '../../prisma.js'
import { buildSystemPrompt } from '../../services/aiService.js'

const router = Router()

// ─── FAQ ─────────────────────────────────────────────────────────────────────

router.get('/clients/:tenantId/faq', async (req, res) => {
  const { tenantId } = req.params
  try {
    const entries = await prisma.faqEntry.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })
    res.json(entries)
  } catch (err) {
    console.error('[ops/faq GET] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/clients/:tenantId/faq', async (req, res) => {
  const { tenantId } = req.params
  const { question, answer, propertyId } = req.body as {
    question?: string
    answer?: string
    propertyId?: string
  }

  if (!question?.trim() || !answer?.trim()) {
    res.status(400).json({ error: 'question and answer are required' })
    return
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' })
    return
  }

  try {
    const entry = await prisma.faqEntry.create({
      data: {
        tenantId,
        question: question.trim(),
        answer: answer.trim(),
        propertyId: propertyId ?? null,
      },
    })
    res.status(201).json(entry)
  } catch (err) {
    console.error('[ops/faq POST] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/clients/:tenantId/faq/:faqId', async (req, res) => {
  const { tenantId, faqId } = req.params
  const { question, answer, isActive } = req.body as {
    question?: string
    answer?: string
    isActive?: boolean
  }

  const entry = await prisma.faqEntry.findFirst({ where: { id: faqId, tenantId } })
  if (!entry) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    const updated = await prisma.faqEntry.update({
      where: { id: faqId },
      data: {
        ...(question !== undefined && { question: question.trim() }),
        ...(answer !== undefined && { answer: answer.trim() }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    res.json(updated)
  } catch (err) {
    console.error('[ops/faq PUT] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.delete('/clients/:tenantId/faq/:faqId', async (req, res) => {
  const { tenantId, faqId } = req.params

  const entry = await prisma.faqEntry.findFirst({ where: { id: faqId, tenantId } })
  if (!entry) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    await prisma.faqEntry.delete({ where: { id: faqId } })
    res.json({ ok: true })
  } catch (err) {
    console.error('[ops/faq DELETE] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Prompt ──────────────────────────────────────────────────────────────────

router.get('/clients/:tenantId/prompt', async (req, res) => {
  const { tenantId } = req.params

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' })
    return
  }

  // Отдаём три части раздельно:
  // - basePrompt: базовый шаблон (read-only, генерируется кодом, без customPrompt)
  // - customPrompt: доп. инструкция клиента (редактируемая)
  // - effectivePrompt: что реально получает бот (база + секция customPrompt)
  // customPrompt не заменяет базовый, а дописывается секцией — см. buildSystemPrompt.
  const basePrompt = buildSystemPrompt({
    botName: tenant.botName,
    property: null,
    faqEntries: [],
    memorySummary: '',
  })
  const effectivePrompt = buildSystemPrompt({
    botName: tenant.botName,
    property: null,
    faqEntries: [],
    memorySummary: '',
    customPrompt: tenant.customPrompt,
  })

  res.json({
    basePrompt,
    customPrompt: tenant.customPrompt ?? '',
    effectivePrompt,
    isCustom: tenant.customPrompt !== null,
  })
})

router.put('/clients/:tenantId/prompt', async (req, res) => {
  const { tenantId } = req.params
  const { prompt } = req.body as { prompt?: string }

  if (prompt === undefined) {
    res.status(400).json({ error: 'prompt is required' })
    return
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' })
    return
  }

  try {
    await prisma.tenant.update({
      where: { id: tenantId },
      // null = reset to default, empty string clears custom
      data: { customPrompt: prompt.trim() || null },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('[ops/prompt PUT] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

// ─── Properties ───────────────────────────────────────────────────────────────

router.get('/clients/:tenantId/properties', async (req, res) => {
  const { tenantId } = req.params
  try {
    const properties = await prisma.property.findMany({
      where: { tenantId },
      orderBy: { createdAt: 'asc' },
    })
    res.json(properties)
  } catch (err) {
    console.error('[ops/properties GET] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/clients/:tenantId/properties', async (req, res) => {
  const { tenantId } = req.params
  const { name, address, description, avitoItemId } = req.body as {
    name?: string
    address?: string
    description?: string
    avitoItemId?: string
  }

  if (!name?.trim()) {
    res.status(400).json({ error: 'name is required' })
    return
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' })
    return
  }

  try {
    const property = await prisma.property.create({
      data: {
        tenantId,
        name: name.trim(),
        address: address?.trim() ?? '',
        description: description?.trim() ?? '',
        avitoItemId: avitoItemId?.trim() ?? '',
        isActive: true,
      },
    })
    res.status(201).json(property)
  } catch (err) {
    console.error('[ops/properties POST] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/clients/:tenantId/properties/:propertyId', async (req, res) => {
  const { tenantId, propertyId } = req.params
  const { name, address, description, avitoItemId, isActive } = req.body as {
    name?: string
    address?: string
    description?: string
    avitoItemId?: string
    isActive?: boolean
  }

  const property = await prisma.property.findFirst({ where: { id: propertyId, tenantId } })
  if (!property) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    const updated = await prisma.property.update({
      where: { id: propertyId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(address !== undefined && { address: address.trim() }),
        ...(description !== undefined && { description: description.trim() }),
        ...(avitoItemId !== undefined && { avitoItemId: avitoItemId.trim() }),
        ...(isActive !== undefined && { isActive }),
      },
    })
    res.json(updated)
  } catch (err) {
    console.error('[ops/properties PUT] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
