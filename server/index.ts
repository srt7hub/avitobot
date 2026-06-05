import express from 'express'
import cors from 'cors'
import { authMiddleware } from './middleware/auth.js'
import authRoutes from './routes/auth.js'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'avitobot-api' }))

app.use('/api/auth', authRoutes)

// Защищаем все /api роуты кроме /auth и /health
app.use('/api', (req, res, next) => {
  if (req.path.startsWith('/auth') || req.path === '/health') return next()
  authMiddleware(req, res, next)
})

app.listen(3010, () => console.log('[api] Running on :3010'))
