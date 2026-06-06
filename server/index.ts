import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { authMiddleware } from './middleware/auth.js'
import { clientOnly } from './middleware/clientOnly.js'
import { opsOnly } from './middleware/auth.js'
import authRoutes from './routes/auth.js'
import dashboardRoutes from './routes/client/dashboard.js'
import faqRoutes from './routes/client/faq.js'
import propertiesRoutes from './routes/client/properties.js'
import settingsRoutes from './routes/client/settings.js'
import dialoguesRoutes from './routes/client/dialogues.js'
import clientsRoutes from './routes/ops/clients.js'
import avitoRoutes from './routes/ops/avito.js'
import contentRoutes from './routes/ops/content.js'
import logsRoutes from './routes/ops/logs.js'
import prisma from './prisma.js'

const app = express()
app.use(cors())
app.use(express.json())

app.use(rateLimit({
  windowMs: 60_000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests' },
}))

app.get('/api/health', async (_, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`
    const activeBots = await prisma.botSession.count({ where: { isRunning: true } })
    res.json({ status: 'ok', service: 'avitobot-api', db: 'connected', activeBots, uptime: process.uptime() })
  } catch {
    res.status(503).json({ status: 'error', db: 'disconnected' })
  }
})

app.use('/api/auth', authRoutes)

app.use('/api/client', authMiddleware, clientOnly, dashboardRoutes)
app.use('/api/client', authMiddleware, clientOnly, faqRoutes)
app.use('/api/client', authMiddleware, clientOnly, propertiesRoutes)
app.use('/api/client', authMiddleware, clientOnly, settingsRoutes)
app.use('/api/client', authMiddleware, clientOnly, dialoguesRoutes)

app.use('/api/ops', authMiddleware, opsOnly, clientsRoutes)
app.use('/api/ops', authMiddleware, opsOnly, avitoRoutes)
app.use('/api/ops', authMiddleware, opsOnly, contentRoutes)
app.use('/api/ops', authMiddleware, opsOnly, logsRoutes)

app.listen(3010, () => console.log('[api] Running on :3010'))
