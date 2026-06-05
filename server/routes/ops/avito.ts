import { Router } from 'express'
import prisma from '../../prisma.js'
import { getAllChats, type TenantAvitoConfig } from '../../services/avitoService.js'

const router = Router()

router.put('/clients/:tenantId/avito', async (req, res) => {
  const { tenantId } = req.params
  const { avitoClientId, avitoClientSecret, avitoUserId, refreshToken } = req.body as {
    avitoClientId?: string
    avitoClientSecret?: string
    avitoUserId?: string
    refreshToken?: string
  }

  if (!avitoClientId || !avitoClientSecret || !avitoUserId) {
    res.status(400).json({ error: 'avitoClientId, avitoClientSecret, avitoUserId are required' })
    return
  }

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' })
    return
  }

  try {
    const config = await prisma.tenantAvitoConfig.upsert({
      where: { tenantId },
      update: {
        avitoClientId: avitoClientId.trim(),
        avitoClientSecret: avitoClientSecret.trim(),
        avitoUserId: avitoUserId.trim(),
        refreshToken: refreshToken?.trim() ?? '',
        accessToken: '',
        tokenExpiresAt: null,
      },
      create: {
        tenantId,
        avitoClientId: avitoClientId.trim(),
        avitoClientSecret: avitoClientSecret.trim(),
        avitoUserId: avitoUserId.trim(),
        refreshToken: refreshToken?.trim() ?? '',
      },
    })
    res.json({ ok: true, configId: config.id })
  } catch (err) {
    console.error('[ops/avito PUT] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/clients/:tenantId/avito/test', async (req, res) => {
  const { tenantId } = req.params

  const dbConfig = await prisma.tenantAvitoConfig.findUnique({ where: { tenantId } })
  if (!dbConfig) {
    res.status(404).json({ ok: false, error: 'No Avito config found for this tenant' })
    return
  }

  const config: TenantAvitoConfig = {
    id: dbConfig.id,
    tenantId: dbConfig.tenantId,
    avitoClientId: dbConfig.avitoClientId,
    avitoClientSecret: dbConfig.avitoClientSecret,
    avitoUserId: dbConfig.avitoUserId,
    accessToken: dbConfig.accessToken,
    refreshToken: dbConfig.refreshToken,
    tokenExpiresAt: dbConfig.tokenExpiresAt,
    pollingEnabled: dbConfig.pollingEnabled,
  }

  try {
    const chats = await getAllChats(config)
    res.json({ ok: true, chatCount: chats.length })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    res.json({ ok: false, error: message })
  }
})

router.post('/clients/:tenantId/bot/restart', async (req, res) => {
  const { tenantId } = req.params

  const tenant = await prisma.tenant.findUnique({ where: { id: tenantId } })
  if (!tenant) {
    res.status(404).json({ error: 'Tenant not found' })
    return
  }

  try {
    await Promise.all([
      prisma.botSession.upsert({
        where: { tenantId },
        update: { errorCount: 0, lastError: '' },
        create: { tenantId, isRunning: false },
      }),
      prisma.tenantAvitoConfig.updateMany({
        where: { tenantId },
        data: { pollingEnabled: true },
      }),
    ])
    res.json({ ok: true })
  } catch (err) {
    console.error('[ops/bot/restart] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
