import { randomUUID } from 'node:crypto'
import type { NextFunction, Request, Response } from 'express'

const requestIdPattern = /^[A-Za-z0-9._:-]{1,100}$/

export function requestId(req: Request, res: Response, next: NextFunction): void {
  const header = req.header('x-request-id')
  const id = header && requestIdPattern.test(header) ? header : randomUUID()

  req.id = id
  res.setHeader('X-Request-Id', id)
  next()
}
