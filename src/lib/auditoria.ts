import { isIP } from 'node:net'
import type { Request } from 'express'
import type { Prisma } from '../generated/prisma/client.js'

type DbClient = Pick<Prisma.TransactionClient, 'auditoria'>

export interface AuditoriaInput {
  usuarioId?: string | null
  accion: string
  tabla?: string
  registroId?: string | bigint | null
  detalle?: Prisma.InputJsonValue
  ip?: string | null
}

export async function registrarAuditoria(db: DbClient, input: AuditoriaInput): Promise<void> {
  await db.auditoria.create({
    data: {
      usuario_id: input.usuarioId ? BigInt(input.usuarioId) : null,
      accion: input.accion,
      tabla: input.tabla,
      registro_id: input.registroId?.toString(),
      detalle: input.detalle,
      ip: input.ip ?? null,
    },
  })
}

export function obtenerIp(req: Request): string | null {
  const ip = req.ip?.replace(/^::ffff:/, '')

  return ip && isIP(ip) ? ip : null
}
