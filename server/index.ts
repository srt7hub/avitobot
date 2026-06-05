import express from 'express'
import cors from 'cors'
import { authMiddleware } from './middleware/auth.js'
import { clientOnly } from './middleware/clientOnly.js'
import authRoutes from './routes/auth.js'
import dashboardRoutes from './routes/client/dashboard.js'
import faqRoutes from './routes/client/faq.js'
import propertiesRoutes from './routes/client/properties.js'
import settingsRoutes from './routes/client/settings.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'avitobot-api' }))

app.use('/api/auth', authRoutes)

app.use('/api/client', authMiddleware, clientOnly, dashboardRoutes)
app.use('/api/client', authMiddleware, clientOnly, faqRoutes)
app.use('/api/client', authMiddleware, clientOnly, propertiesRoutes)
app.use('/api/client', authMiddleware, clientOnly, settingsRoutes)

// Защищаем все /api роуты кроме /auth и /health
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth') || req.path === '/health') return next()
  authMiddleware(req, res, next)
})

app.listen(3010, () => console.log('[api] Running on :3010'))
