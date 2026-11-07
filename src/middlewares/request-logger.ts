import type { NextFunction, Request, Response } from 'express'
import { logger } from '../lib/logger.js'

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/health' || req.path === '/health/ready') {
    next()
    return
  }

  const startedAt = process.hrtime.bigint()

  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1_000_000

    logger.info(
      {
        requestId: req.id,
        method: req.method,
        path: req.originalUrl,
        status: res.statusCode,
        durationMs: Math.round(durationMs),
        userId: req.user?.id,
        rol: req.user?.rol,
      },
      'request',
    )
  })

  next()
}
