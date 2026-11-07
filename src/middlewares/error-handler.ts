import type { NextFunction, Request, Response } from 'express'
import { ZodError } from 'zod'
import { logger } from '../lib/logger.js'
import { HttpError } from '../lib/http-error.js'

function esJsonInvalido(error: unknown): boolean {
  return (
    error instanceof SyntaxError &&
    'status' in error &&
    (error as { status?: number }).status === 400
  )
}

export function notFoundHandler(req: Request, _res: Response, next: NextFunction): void {
  next(new HttpError(404, `Ruta no encontrada: ${req.method} ${req.originalUrl}`, 'NOT_FOUND'))
}

export function errorHandler(
  error: unknown,
  req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (esJsonInvalido(error)) {
    res.status(400).json({
      error: 'INVALID_JSON',
      message: 'El cuerpo de la solicitud no es JSON válido',
      requestId: req.id,
    })
    return
  }

  if (error instanceof ZodError) {
    res.status(422).json({
      error: 'VALIDATION_ERROR',
      message: 'Datos de entrada inválidos',
      requestId: req.id,
      details: error.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    })
    return
  }

  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: error.code,
      message: error.message,
      requestId: req.id,
    })
    return
  }

  logger.error({ err: error, requestId: req.id }, 'Error no controlado')
  res.status(500).json({
    error: 'INTERNAL_SERVER_ERROR',
    message: 'Error interno del servidor',
    requestId: req.id,
  })
}
