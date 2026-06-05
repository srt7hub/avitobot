import { Router } from 'express'
import prisma from '../../prisma.js'

const router = Router()

router.get('/status', async (_req, res) => {
  try {
    const sessions = await prisma.botSession.findMany()
    res.json({
      totalClients: sessions.length,
      runningBots: sessions.filter(s => s.isRunning).length,
      errorBots: sessions.filter(s => s.errorCount > 0).length,
      totalMessagesToday: sessions.reduce((sum, s) => sum + s.messagesDay, 0),
    })
  } catch (err) {
    console.error('[ops/status] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/clients/:tenantId/dialogues', async (req, res) => {
  const { tenantId } = req.params
  const limit = Math.min(Number(req.query.limit) || 20, 100)
  const offset = Number(req.query.offset) || 0

  try {
    const dialogues = await prisma.dialogue.findMany({
      where: { tenantId },
      orderBy: { updatedAt: 'desc' },
      skip: offset,
      take: limit,
      include: {
        messages: {
          orderBy: { processedAt: 'desc' },
          take: 1,
        },
      },
    })
    res.json(dialogues)
  } catch (err) {
    console.error('[ops/dialogues GET] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/clients/:tenantId/dialogues/:dialogueId/messages', async (req, res) => {
  const { tenantId, dialogueId } = req.params

  const dialogue = await prisma.dialogue.findFirst({ where: { id: dialogueId, tenantId } })
  if (!dialogue) {
    res.status(404).json({ error: 'Not found' })
    return
  }

  try {
    const messages = await prisma.message.findMany({
      where: { dialogueId },
      orderBy: { processedAt: 'asc' },
    })
    res.json(messages)
  } catch (err) {
    console.error('[ops/messages GET] error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
