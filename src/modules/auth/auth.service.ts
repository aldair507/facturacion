import { env } from '../../config/env.js'
import { prisma } from '../../db/prisma.js'
import { registrarAuditoria } from '../../lib/auditoria.js'
import { HttpError } from '../../lib/http-error.js'
import { logger } from '../../lib/logger.js'
import { hashearPassword, verificarPassword } from '../../lib/password.js'
import { esRolNombre, type AuthUser } from './auth.types.js'

async function auditarLogin(
  usuarioId: string | null,
  accion: 'LOGIN' | 'LOGIN_FALLIDO',
  email: string,
  ip: string | null,
): Promise<void> {
  if (env.NODE_ENV === 'test') return

  try {
    await registrarAuditoria(prisma, {
      usuarioId,
      accion,
      tabla: 'usuarios',
      registroId: usuarioId,
      detalle: { email },
      ip,
    })
  } catch (error) {
    logger.error({ err: error }, 'No se pudo registrar auditoría de login')
  }
}

export async function login(
  email: string,
  password: string,
  ip: string | null = null,
): Promise<AuthUser> {
  const usuario = await prisma.usuarios.findUnique({
    where: { email },
    include: { roles: true },
  })

  if (!usuario || !usuario.activo) {
    await auditarLogin(usuario?.id.toString() ?? null, 'LOGIN_FALLIDO', email, ip)
    throw new HttpError(401, 'Credenciales inválidas', 'INVALID_CREDENTIALS')
  }

  const passwordValida = await verificarPassword(password, usuario.password_hash)

  if (!passwordValida) {
    await auditarLogin(usuario.id.toString(), 'LOGIN_FALLIDO', email, ip)
    throw new HttpError(401, 'Credenciales inválidas', 'INVALID_CREDENTIALS')
  }

  if (!esRolNombre(usuario.roles.nombre)) {
    throw new HttpError(403, 'Rol no autorizado', 'FORBIDDEN')
  }

  await prisma.usuarios.update({
    where: { id: usuario.id },
    data: { ultimo_acceso: new Date() },
  })

  await auditarLogin(usuario.id.toString(), 'LOGIN', email, ip)

  return {
    id: usuario.id.toString(),
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.roles.nombre,
    tokenVersion: usuario.token_version,
  }
}

export async function cambiarPassword(
  id: string,
  passwordActual: string,
  passwordNueva: string,
): Promise<void> {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: BigInt(id) },
  })

  if (!usuario || !usuario.activo) {
    throw new HttpError(401, 'Usuario no válido o inactivo', 'UNAUTHENTICATED')
  }

  const passwordValida = await verificarPassword(passwordActual, usuario.password_hash)

  if (!passwordValida) {
    throw new HttpError(401, 'La contraseña actual es incorrecta', 'INVALID_CREDENTIALS')
  }

  const password_hash = await hashearPassword(passwordNueva)

  await prisma.usuarios.update({
    where: { id: usuario.id },
    data: {
      password_hash,
      token_version: { increment: 1 },
    },
  })
}

export async function obtenerUsuarioActual(id: string): Promise<AuthUser> {
  const usuario = await prisma.usuarios.findUnique({
    where: { id: BigInt(id) },
    include: { roles: true },
  })

  if (!usuario || !usuario.activo) {
    throw new HttpError(401, 'Usuario no válido o inactivo', 'UNAUTHENTICATED')
  }

  if (!esRolNombre(usuario.roles.nombre)) {
    throw new HttpError(403, 'Rol no autorizado', 'FORBIDDEN')
  }

  return {
    id: usuario.id.toString(),
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.roles.nombre,
    tokenVersion: usuario.token_version,
  }
}
