import { prisma } from '../../db/prisma.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { registrarAuditoria } from '../../lib/auditoria.js'
import { HttpError } from '../../lib/http-error.js'
import { calcularSkip, crearMeta, type MetaPaginacion } from '../../lib/pagination.js'
import { esNoEncontrado } from '../../lib/prisma-errors.js'
import { toCajaDTO, type CajaDTO } from './cajas.mapper.js'
import type { ActualizarCajaInput, CrearCajaInput, ListarCajasQuery } from './cajas.schemas.js'

const cajaInclude = {
  cierres_caja: {
    where: { estado: 'ABIERTO' as const },
    select: { id: true, fecha_apertura: true, base_inicial: true },
    orderBy: { id: 'desc' as const },
    take: 1,
  },
} satisfies Prisma.cajasInclude

export interface ListarCajasResult {
  data: CajaDTO[]
  meta: MetaPaginacion
}

export async function listarCajas(params: ListarCajasQuery): Promise<ListarCajasResult> {
  const where: Prisma.cajasWhereInput = {}

  if (params.activo !== undefined) {
    where.activo = params.activo
  }

  if (params.search) {
    where.nombre = { contains: params.search, mode: 'insensitive' }
  }

  const [total, cajas] = await prisma.$transaction([
    prisma.cajas.count({ where }),
    prisma.cajas.findMany({
      where,
      include: cajaInclude,
      orderBy: { id: 'asc' },
      skip: calcularSkip(params),
      take: params.limit,
    }),
  ])

  return {
    data: cajas.map(toCajaDTO),
    meta: crearMeta(params, total),
  }
}

export async function obtenerCaja(id: number): Promise<CajaDTO> {
  const caja = await prisma.cajas.findUnique({
    where: { id },
    include: cajaInclude,
  })

  if (!caja) {
    throw new HttpError(404, 'Caja no encontrada', 'NOT_FOUND')
  }

  return toCajaDTO(caja)
}

export async function crearCaja(
  input: CrearCajaInput,
  actorId: string,
  ip: string | null = null,
): Promise<CajaDTO> {
  const caja = await prisma.cajas.create({
    data: { nombre: input.nombre },
    include: cajaInclude,
  })

  await registrarAuditoria(prisma, {
    usuarioId: actorId,
    accion: 'CAJA_CREADA',
    tabla: 'cajas',
    registroId: String(caja.id),
    detalle: { nombre: caja.nombre },
    ip,
  })

  return toCajaDTO(caja)
}

export async function actualizarCaja(
  id: number,
  input: ActualizarCajaInput,
  actorId: string,
  ip: string | null = null,
): Promise<CajaDTO> {
  try {
    return await prisma.$transaction(async (tx) => {
      const bloqueo = await tx.$queryRaw<Array<{ id: number }>>`
        SELECT id FROM cajas WHERE id = ${id} FOR UPDATE
      `

      if (bloqueo.length === 0) {
        throw new HttpError(404, 'Caja no encontrada', 'NOT_FOUND')
      }

      if (input.activo === false) {
        const abierto = await tx.cierres_caja.findFirst({
          where: { caja_id: id, estado: 'ABIERTO' },
          select: { id: true },
        })

        if (abierto) {
          throw new HttpError(
            409,
            'No puedes desactivar una caja con un cierre abierto',
            'CAJA_CON_CIERRE_ABIERTO',
          )
        }
      }

      const caja = await tx.cajas.update({
        where: { id },
        data: input,
        include: cajaInclude,
      })

      await registrarAuditoria(tx, {
        usuarioId: actorId,
        accion: input.activo === false ? 'CAJA_DESACTIVADA' : 'CAJA_ACTUALIZADA',
        tabla: 'cajas',
        registroId: String(caja.id),
        detalle: input,
        ip,
      })

      return toCajaDTO(caja)
    })
  } catch (error) {
    if (esNoEncontrado(error)) {
      throw new HttpError(404, 'Caja no encontrada', 'NOT_FOUND')
    }
    throw error
  }
}

export async function desactivarCaja(
  id: number,
  actorId: string,
  ip: string | null = null,
): Promise<CajaDTO> {
  return actualizarCaja(id, { activo: false }, actorId, ip)
}
