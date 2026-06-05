import { Router } from 'express'
import bcrypt from 'bcryptjs'
import prisma from '../../prisma.js'

const router = Router()

const SLUG_RE = /^[a-z0-9-]+$/

router.get('/clients', async (_req, res) => {
  try {
    const tenants = await prisma.tenant.findMany({
      where: { slug: { not: 'ops-internal' } },
      orderBy: { createdAt: 'desc' },
      include: { botSessions: true, avitoConfig: { select: { id: true } } },
    })

    const clients = tenants.map(t => ({
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      bot: t.botSessions[0]
        ? {
            isRunning: t.botSessions[0].isRunning,
            lastPollAt: t.botSessions[0].lastPollAt,
            errorCount: t.botSessions[0].errorCount,
            todayMessages: t.botSessions[0].messagesDay,
          }
        : { isRunning: false, lastPollAt: null, errorCount: 0, todayMessages: 0 },
      hasAvitoConfig: t.avitoConfig !== null,
      createdAt: t.createdAt,
    }))

    res.json({ clients })
  } catch (err) {
    console.error('[ops/clients GET] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/clients', async (req, res) => {
  const { name, slug, botName, managerEmail, managerPassword, managerName, telegramBotToken, telegramChatId } =
    req.body as {
      name?: string
      slug?: string
      botName?: string
      managerEmail?: string
      managerPassword?: string
      managerName?: string
      telegramBotToken?: string
      telegramChatId?: string
    }

  if (!name?.trim() || !slug?.trim() || !managerEmail?.trim() || !managerPassword) {
    res.status(400).json({ error: 'name, slug, managerEmail, managerPassword are required' })
    return
  }
  if (!SLUG_RE.test(slug)) {
    res.status(400).json({ error: 'slug must contain only lowercase letters, digits and hyphens' })
    return
  }

  try {
    const hash = await bcrypt.hash(managerPassword, 12)

    const tenant = await prisma.tenant.create({
      data: {
        name: name.trim(),
        slug: slug.trim(),
        botName: botName?.trim() ?? 'Менеджер',
        telegramBotToken: telegramBotToken?.trim() ?? '',
        telegramChatId: telegramChatId?.trim() ?? '',
        users: {
          create: {
            email: managerEmail.trim().toLowerCase(),
            password: hash,
            role: 'CLIENT',
            name: managerName?.trim() ?? managerEmail.trim(),
          },
        },
        botSessions: {
          create: { isRunning: false },
        },
      },
    })

    res.status(201).json({ tenantId: tenant.id, message: 'Client created' })
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    if (msg.includes('Unique constraint')) {
      res.status(409).json({ error: 'Slug already taken' })
      return
    }
    console.error('[ops/clients POST] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/clients/:tenantId', async (req, res) => {
  const { tenantId } = req.params

  try {
    const [tenant, avitoConfig, properties, botSession, totalFaq, totalDialogues] =
      await Promise.all([
        prisma.tenant.findUnique({ where: { id: tenantId } }),
        prisma.tenantAvitoConfig.findUnique({ where: { tenantId } }),
        prisma.property.findMany({ where: { tenantId } }),
        prisma.botSession.findUnique({ where: { tenantId } }),
        prisma.faqEntry.count({ where: { tenantId } }),
        prisma.dialogue.count({ where: { tenantId } }),
      ])

    if (!tenant) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    res.json({
      tenant,
      avitoConfig,
      properties,
      botSession,
      recentErrors: botSession?.lastError ? [botSession.lastError] : [],
      stats: {
        totalFaq,
        totalProperties: properties.length,
        totalDialogues,
      },
    })
  } catch (err) {
    console.error('[ops/clients/:id GET] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/clients/:tenantId', async (req, res) => {
  const { tenantId } = req.params
  const { name, botName, status, telegramBotToken, telegramChatId } = req.body as {
    name?: string
    botName?: string
    status?: 'TRIAL' | 'ACTIVE' | 'PAUSED' | 'CANCELLED'
    telegramBotToken?: string
    telegramChatId?: string
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    const updated = await prisma.tenant.update({
      where: { id: tenantId },
      data: {
        ...(name !== undefined && { name: name.trim() }),
        ...(botName !== undefined && { botName: botName.trim() }),
        ...(status !== undefined && { status }),
        ...(telegramBotToken !== undefined && { telegramBotToken: telegramBotToken.trim() }),
        ...(telegramChatId !== undefined && { telegramChatId: telegramChatId.trim() }),
      },
    })
    res.json(updated)
  } catch (err) {
    console.error('[ops/clients/:id PUT] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
