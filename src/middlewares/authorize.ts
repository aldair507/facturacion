import type { NextFunction, Request, RequestHandler, Response } from 'express'
import { HttpError } from '../lib/http-error.js'
import type { RolNombre } from '../modules/auth/auth.types.js'

export function authorize(...roles: RolNombre[]): RequestHandler {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user) {
      next(new HttpError(401, 'No autenticado', 'UNAUTHENTICATED'))
      return
    }

    if (!roles.includes(req.user.rol)) {
      next(new HttpError(403, 'No tienes permisos para esta acción', 'FORBIDDEN'))
      return
    }

    next()
  }
}
