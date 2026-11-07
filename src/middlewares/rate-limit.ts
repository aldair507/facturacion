import rateLimit from 'express-rate-limit'
import { env } from '../config/env.js'

function omitir(): boolean {
  return !env.RATE_LIMIT_ENABLED || env.NODE_ENV === 'test'
}

function responder(
  _req: unknown,
  res: { status: (status: number) => { json: (body: unknown) => void } },
): void {
  res.status(429).json({
    error: 'RATE_LIMITED',
    message: 'Demasiadas solicitudes, intenta de nuevo más tarde',
  })
}

export const apiLimiter = rateLimit({
  windowMs: 60_000,
  limit: 300,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: omitir,
  handler: responder,
})

export const loginLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: omitir,
  handler: responder,
})
