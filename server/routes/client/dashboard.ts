import { Router } from 'express'
import prisma from '../../prisma.js'

const router = Router()

router.get('/dashboard', async (req, res) => {
  const tenantId = req.auth!.tenantId!

  try {
    const [session, dialogues, unhandledCount] = await Promise.all([
      prisma.botSession.findUnique({ where: { tenantId } }),
      prisma.dialogue.findMany({
        where: { tenantId },
        orderBy: { updatedAt: 'desc' },
        take: 10,
        include: {
          messages: {
            where: { role: 'GUEST' },
            orderBy: { processedAt: 'desc' },
            take: 1,
          },
        },
      }),
      prisma.unhandledQuestion.count({ where: { tenantId, isResolved: false } }),
    ])

    res.json({
      bot: {
        isRunning: session?.isRunning ?? false,
        lastPollAt: session?.lastPollAt ?? null,
        errorCount: session?.errorCount ?? 0,
      },
      stats: {
        today: session?.messagesDay ?? 0,
        week: session?.messagesWeek ?? 0,
        month: session?.messagesMonth ?? 0,
        autoReplyRate: session?.autoReplyRate ?? 0,
      },
      recentDialogues: dialogues.map(d => ({
        id: d.id,
        guestName: d.guestName,
        lastMessage: d.messages[0]?.content.slice(0, 60) ?? '',
        wasHumanTakeover: d.pausedUntil !== null,
        updatedAt: d.updatedAt,
      })),
      unhandledCount,
    })
  } catch (err) {
    console.error('[dashboard] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/bot/start', async (req, res) => {
  const tenantId = req.auth!.tenantId!
  try {
    await prisma.tenantAvitoConfig.update({
      where: { tenantId },
      data: { pollingEnabled: true },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('[bot/start] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/bot/stop', async (req, res) => {
  const tenantId = req.auth!.tenantId!
  try {
    await prisma.tenantAvitoConfig.update({
      where: { tenantId },
      data: { pollingEnabled: false },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('[bot/stop] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.post('/bot/pause', async (req, res) => {
  const tenantId = req.auth!.tenantId!
  const { until } = req.body as { until: string | null }
  try {
    await prisma.tenantAvitoConfig.update({
      where: { tenantId },
      data: { pollingEnabled: until === null },
    })
    res.json({ ok: true })
  } catch (err) {
    console.error('[bot/pause] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
