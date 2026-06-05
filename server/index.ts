import express from 'express'
import cors from 'cors'

const app = express()
app.use(cors())
app.use(express.json())

app.get('/api/health', (_, res) => res.json({ status: 'ok', service: 'avitobot-api' }))

app.listen(3010, () => console.log('[api] Running on :3010'))
