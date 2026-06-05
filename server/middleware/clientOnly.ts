import { Request, Response, NextFunction } from 'express'

export function clientOnly(req: Request, res: Response, next: NextFunction): void {
  if (!req.auth || (req.auth.role !== 'CLIENT' && req.auth.role !== 'OPS')) {
    res.status(403).json({ error: 'Forbidden' })
    return
  }
  // OPS может действовать от имени любого клиента (для поддержки)
  next()
}
