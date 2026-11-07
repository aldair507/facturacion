import jwt, { type SignOptions } from 'jsonwebtoken'
import { env } from '../config/env.js'
import { esRolNombre, type AuthUser } from '../modules/auth/auth.types.js'
import { HttpError } from './http-error.js'

export function firmarToken(user: AuthUser): string {
  return jwt.sign(
    {
      sub: user.id,
      email: user.email,
      nombre: user.nombre,
      rol: user.rol,
      ver: user.tokenVersion,
    },
    env.JWT_SECRET,
    { expiresIn: env.JWT_EXPIRES_IN as SignOptions['expiresIn'] },
  )
}

export function verificarToken(token: string): AuthUser {
  let decoded: string | jwt.JwtPayload

  try {
    decoded = jwt.verify(token, env.JWT_SECRET)
  } catch {
    throw new HttpError(401, 'Token inválido o expirado', 'INVALID_TOKEN')
  }

  if (
    typeof decoded === 'string' ||
    !decoded.sub ||
    typeof decoded.email !== 'string' ||
    typeof decoded.nombre !== 'string' ||
    !esRolNombre(decoded.rol) ||
    typeof decoded.ver !== 'number' ||
    !Number.isInteger(decoded.ver)
  ) {
    throw new HttpError(401, 'Token inválido o expirado', 'INVALID_TOKEN')
  }

  return {
    id: decoded.sub,
    email: decoded.email,
    nombre: decoded.nombre,
    rol: decoded.rol,
    tokenVersion: decoded.ver,
  }
}
