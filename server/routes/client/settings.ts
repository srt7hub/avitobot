import { Router } from 'express'
import prisma from '../../prisma.js'
import { refreshTokenIfNeeded } from '../../services/avitoService.js'

const router = Router()

router.get('/settings', async (req, res) => {
  const { tenantId, userId } = req.auth!

  try {
    const [tenant, user, avitoConfig] = await Promise.all([
      prisma.tenant.findUnique({ where: { id: tenantId! } }),
      prisma.tenantUser.findUnique({ where: { id: userId } }),
      prisma.tenantAvitoConfig.findUnique({ where: { tenantId: tenantId! } }),
    ])

    if (!tenant || !user) {
      res.status(404).json({ error: 'Not found' })
      return
    }

    res.json({
      botName: tenant.botName,
      customPrompt: tenant.customPrompt ?? '',
      telegramContact: user.telegramContact,
      avitoClientId: avitoConfig?.avitoClientId ?? '',
      avitoUserId: avitoConfig?.avitoUserId ?? '',
    })
  } catch (err) {
    console.error('[settings GET] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.put('/settings', async (req, res) => {
  const { tenantId, userId } = req.auth!
  const { botName, telegramContact, customPrompt } = req.body as {
    botName?: string
    telegramContact?: string
    customPrompt?: string
  }

  try {
    await Promise.all([
      (botName !== undefined || customPrompt !== undefined)
        ? prisma.tenant.update({
            where: { id: tenantId! },
            data: {
              ...(botName !== undefined && { botName: botName.trim() }),
              ...(customPrompt !== undefined && { customPrompt: customPrompt.trim() || null }),
            },
          })
        : Promise.resolve(),
      telegramContact !== undefined
        ? prisma.tenantUser.update({ where: { id: userId }, data: { telegramContact: telegramContact.trim() } })
        : Promise.resolve(),
    ])

    res.json({ ok: true })
  } catch (err) {
    console.error('[settings PUT] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/settings/avito-check', async (req, res) => {
  const { tenantId } = req.auth!

  try {
    const avitoConfig = await prisma.tenantAvitoConfig.findUnique({ where: { tenantId: tenantId! } })

    if (!avitoConfig || !avitoConfig.avitoClientId || !avitoConfig.avitoClientSecret || !avitoConfig.avitoUserId) {
      res.json({ ok: false, error: 'Ключи не заданы' })
      return
    }

    await refreshTokenIfNeeded({
      id: avitoConfig.id,
      tenantId: tenantId!,
      avitoClientId: avitoConfig.avitoClientId,
      avitoClientSecret: avitoConfig.avitoClientSecret,
      avitoUserId: avitoConfig.avitoUserId,
      accessToken: avitoConfig.accessToken,
      refreshToken: avitoConfig.refreshToken,
      tokenExpiresAt: avitoConfig.tokenExpiresAt,
      pollingEnabled: avitoConfig.pollingEnabled,
    })

    res.json({ ok: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : 'Ошибка подключения'
    res.json({ ok: false, error: msg })
  }
})

router.put('/settings/avito', async (req, res) => {
  const { tenantId } = req.auth!
  const { avitoClientId, avitoClientSecret, avitoUserId } = req.body as {
    avitoClientId?: string
    avitoClientSecret?: string
    avitoUserId?: string
  }

  try {
    await prisma.tenantAvitoConfig.upsert({
      where: { tenantId: tenantId! },
      create: {
        tenantId: tenantId!,
        avitoClientId: (avitoClientId ?? '').trim(),
        avitoClientSecret: (avitoClientSecret ?? '').trim(),
        avitoUserId: (avitoUserId ?? '').trim(),
      },
      update: {
        ...(avitoClientId !== undefined && { avitoClientId: avitoClientId.trim() }),
        ...(avitoClientSecret !== undefined && { avitoClientSecret: avitoClientSecret.trim() }),
        ...(avitoUserId !== undefined && { avitoUserId: avitoUserId.trim() }),
      },
    })

    res.json({ ok: true })
  } catch (err) {
    console.error('[settings/avito PUT] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
