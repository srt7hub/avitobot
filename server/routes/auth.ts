import { Router } from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import prisma from '../prisma.js'
import { authMiddleware, type AuthPayload } from '../middleware/auth.js'

const router = Router()

router.post('/login', async (req, res) => {
  const { email, password } = req.body as { email?: string; password?: string }

  if (!email || !password) {
    res.status(400).json({ error: 'Email and password required' })
    return
  }

  try {
    const user = await prisma.tenantUser.findFirst({ where: { email } })

    if (!user || !(await bcrypt.compare(password, user.password))) {
      res.status(401).json({ error: 'Invalid credentials' })
      return
    }

    const payload: AuthPayload = {
      userId: user.id,
      tenantId: user.role === 'OPS' ? null : user.tenantId,
      role: user.role as 'CLIENT' | 'OPS'
    }

    const token = jwt.sign(payload, process.env.JWT_SECRET!, { expiresIn: '30d' })

    res.json({
      token,
      user: {
        name: user.name,
        email: user.email,
        role: user.role,
        tenantId: payload.tenantId
      }
    })
  } catch (err) {
    console.error('[auth] login error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

router.get('/me', authMiddleware, async (req, res) => {
  const auth = req.auth!

  try {
    const user = await prisma.tenantUser.findUnique({ where: { id: auth.userId } })

    if (!user) {
      res.status(404).json({ error: 'User not found' })
      return
    }

    res.json({
      userId: user.id,
      tenantId: auth.tenantId,
      role: user.role,
      name: user.name,
      email: user.email
    })
  } catch (err) {
    console.error('[auth] me error:', err)
    res.status(500).json({ error: 'Internal server error' })
  }
})

export default router
