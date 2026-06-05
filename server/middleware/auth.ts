import { Request, Response, NextFunction } from 'express'
import jwt from 'jsonwebtoken'

export interface AuthPayload {
  userId: string
  tenantId: string | null
  role: 'CLIENT' | 'OPS'
}

declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload
    }
  }
}

export function authMiddleware(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized' })
    return
  }

  const token = header.slice(7)
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET!) as AuthPayload
    req.auth = payload
    next()
  } catch {
    res.status(401).json({ error: 'Invalid token' })
  }
}

export function opsOnly(req: Request, res: Response, next: NextFunction): void {
  if (req.auth?.role !== 'OPS') {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  next()
}
