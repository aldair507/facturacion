import type { NextFunction, Request, Response } from 'express'
import { prisma } from '../db/prisma.js'
import { HttpError } from '../lib/http-error.js'
import { verificarToken } from '../lib/jwt.js'
import { esRolNombre } from '../modules/auth/auth.types.js'

export async function authenticate(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  const authorization = req.headers.authorization

  if (!authorization?.startsWith('Bearer ')) {
    next(new HttpError(401, 'Token de autenticación requerido', 'UNAUTHENTICATED'))
    return
  }

  try {
    const token = authorization.slice('Bearer '.length).trim()
    const payload = verificarToken(token)

    let id: bigint

    try {
      id = BigInt(payload.id)
    } catch {
      throw new HttpError(401, 'Token inválido o expirado', 'INVALID_TOKEN')
    }

    const usuario = await prisma.usuarios.findUnique({
      where: { id },
      include: { roles: true },
    })

    if (!usuario || !usuario.activo || !esRolNombre(usuario.roles.nombre)) {
      throw new HttpError(401, 'Token inválido o expirado', 'INVALID_TOKEN')
    }

    if (usuario.token_version !== payload.tokenVersion) {
      throw new HttpError(401, 'Token inválido o expirado', 'INVALID_TOKEN')
    }

    req.user = {
      id: usuario.id.toString(),
      nombre: usuario.nombre,
      email: usuario.email,
      rol: usuario.roles.nombre,
      tokenVersion: usuario.token_version,
    }

    next()
  } catch (error) {
    next(error)
  }
}
