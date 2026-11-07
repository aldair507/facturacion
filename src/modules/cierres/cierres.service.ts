import { prisma } from '../../db/prisma.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { registrarAuditoria } from '../../lib/auditoria.js'
import { HttpError } from '../../lib/http-error.js'
import { aDecimal, redondear } from '../../lib/money.js'
import { calcularSkip, crearMeta, type MetaPaginacion } from '../../lib/pagination.js'
import { esDuplicado, esNoEncontrado } from '../../lib/prisma-errors.js'
import type { AuthUser } from '../auth/auth.types.js'
import { toCierreDTO, type CierreDTO } from './cierres.mapper.js'
import type { AbrirCierreInput, CerrarCierreInput, ListarCierresQuery } from './cierres.schemas.js'

const cierreInclude = {
  cajas: { select: { id: true, nombre: true } },
  usuarios: { select: { id: true, nombre: true } },
  _count: { select: { facturas: true } },
} satisfies Prisma.cierres_cajaInclude

export interface ListarCierresResult {
  data: CierreDTO[]
  meta: MetaPaginacion
}

interface TotalesCierreAbierto {
  ventas: string
  efectivo: string
  otros: string
}

async function totalesCierresAbiertos(ids: bigint[]): Promise<Map<string, TotalesCierreAbierto>> {
  const totales = new Map<string, TotalesCierreAbierto>()

  if (ids.length === 0) return totales

  const [ventas, pagos] = await Promise.all([
    prisma.facturas.groupBy({
      by: ['cierre_id'],
      where: {
        cierre_id: { in: ids },
        estado: { not: 'ANULADA' },
      },
      _sum: { total: true },
    }),
    prisma.pagos.findMany({
      where: {
        facturas: {
          is: { cierre_id: { in: ids }, estado: { not: 'ANULADA' } },
        },
      },
      select: {
        metodo: true,
        monto: true,
        facturas: { select: { cierre_id: true } },
      },
    }),
  ])

  for (const id of ids) {
    totales.set(id.toString(), { ventas: '0', efectivo: '0', otros: '0' })
  }

  for (const grupo of ventas) {
    if (grupo.cierre_id === null) continue
    const acumulado = totales.get(grupo.cierre_id.toString())
    if (!acumulado) continue
    acumulado.ventas = redondear(aDecimal(grupo._sum.total ?? 0)).toString()
  }

  for (const pago of pagos) {
    const cierreId = pago.facturas.cierre_id?.toString()
    if (!cierreId) continue

    const acumulado = totales.get(cierreId)
    if (!acumulado) continue

    const campo = pago.metodo === 'EFECTIVO' ? 'efectivo' : 'otros'
    acumulado[campo] = redondear(aDecimal(acumulado[campo]).plus(pago.monto)).toString()
  }

  return totales
}

function aplicarTotalesAbiertos(dto: CierreDTO, totales: TotalesCierreAbierto | undefined): void {
  dto.total_ventas = totales?.ventas ?? '0'
  dto.total_efectivo = totales?.efectivo ?? '0'
  dto.total_otros = totales?.otros ?? '0'
  dto.efectivo_esperado = redondear(
    aDecimal(dto.base_inicial).plus(aDecimal(dto.total_efectivo)),
  ).toString()
}

export async function listarCierres(params: ListarCierresQuery): Promise<ListarCierresResult> {
  const where: Prisma.cierres_cajaWhereInput = {}

  if (params.caja_id !== undefined) {
    where.caja_id = params.caja_id
  }
  if (params.estado) {
    where.estado = params.estado
  }

  const [total, cierres] = await prisma.$transaction([
    prisma.cierres_caja.count({ where }),
    prisma.cierres_caja.findMany({
      where,
      include: cierreInclude,
      orderBy: { id: 'desc' },
      skip: calcularSkip(params),
      take: params.limit,
    }),
  ])

  const abiertos = cierres
    .filter((cierre) => cierre.estado === 'ABIERTO')
    .map((cierre) => cierre.id)
  const totalesAbiertos = await totalesCierresAbiertos(abiertos)

  return {
    data: cierres.map((cierre) => {
      const dto = toCierreDTO(cierre)
      if (cierre.estado === 'ABIERTO') {
        aplicarTotalesAbiertos(dto, totalesAbiertos.get(cierre.id.toString()))
      }
      return dto
    }),
    meta: crearMeta(params, total),
  }
}

export async function obtenerCierre(id: bigint): Promise<CierreDTO> {
  const cierre = await prisma.cierres_caja.findUnique({
    where: { id },
    include: cierreInclude,
  })

  if (!cierre) {
    throw new HttpError(404, 'Cierre no encontrado', 'NOT_FOUND')
  }

  const dto = toCierreDTO(cierre)

  if (cierre.estado === 'ABIERTO') {
    const totales = await totalesCierresAbiertos([cierre.id])
    aplicarTotalesAbiertos(dto, totales.get(cierre.id.toString()))
  }

  return dto
}

export async function abrirCierre(
  input: AbrirCierreInput,
  usuario: AuthUser,
  ip: string | null = null,
): Promise<CierreDTO> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const cajaBloqueada = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM cajas WHERE id = ${input.caja_id} FOR UPDATE
        `

        if (cajaBloqueada.length === 0) {
          throw new HttpError(404, 'Caja no encontrada', 'NOT_FOUND')
        }

        const caja = await tx.cajas.findUniqueOrThrow({ where: { id: input.caja_id } })

        if (!caja.activo) {
          throw new HttpError(409, 'La caja está inactiva', 'CAJA_INACTIVA')
        }

        const abierto = await tx.cierres_caja.findFirst({
          where: { caja_id: caja.id, estado: 'ABIERTO' },
          select: { id: true },
        })

        if (abierto) {
          throw new HttpError(409, 'La caja ya tiene un cierre abierto', 'CIERRE_YA_ABIERTO')
        }

        const cierre = await tx.cierres_caja.create({
          data: {
            caja_id: caja.id,
            usuario_id: BigInt(usuario.id),
            base_inicial: aDecimal(input.base_inicial),
            observaciones: input.observaciones,
          },
        })

        await registrarAuditoria(tx, {
          usuarioId: usuario.id,
          accion: 'CIERRE_ABIERTO',
          tabla: 'cierres_caja',
          registroId: cierre.id,
          detalle: {
            caja_id: caja.id,
            base_inicial: cierre.base_inicial.toString(),
          },
          ip,
        })

        const creado = await tx.cierres_caja.findUniqueOrThrow({
          where: { id: cierre.id },
          include: cierreInclude,
        })

        return toCierreDTO(creado)
      },
      { timeout: 15000 },
    )
  } catch (error) {
    if (esDuplicado(error)) {
      throw new HttpError(409, 'La caja ya tiene un cierre abierto', 'CIERRE_YA_ABIERTO')
    }
    throw error
  }
}

export async function cerrarCierre(
  id: bigint,
  input: CerrarCierreInput,
  usuario: AuthUser,
  ip: string | null = null,
): Promise<CierreDTO> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const bloqueo = await tx.$queryRaw<Array<{ id: bigint }>>`
          SELECT id FROM cierres_caja WHERE id = ${id} FOR UPDATE
        `

        if (bloqueo.length === 0) {
          throw new HttpError(404, 'Cierre no encontrado', 'NOT_FOUND')
        }

        const cierre = await tx.cierres_caja.findUniqueOrThrow({ where: { id } })

        if (cierre.estado !== 'ABIERTO') {
          throw new HttpError(409, 'El cierre ya está cerrado', 'CIERRE_CERRADO')
        }

        if (usuario.rol === 'CAJERO' && cierre.usuario_id.toString() !== usuario.id) {
          throw new HttpError(403, 'No puedes cerrar un cierre de otro usuario', 'FORBIDDEN')
        }

        await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id FROM cajas WHERE id = ${cierre.caja_id} FOR UPDATE
        `

        const pendientes = await tx.facturas.count({
          where: {
            cierre_id: id,
            estado: { in: ['BORRADOR', 'EMITIDA'] },
          },
        })

        if (pendientes > 0) {
          throw new HttpError(
            409,
            `No se puede cerrar: hay ${pendientes} factura(s) pendiente(s) de pago`,
            'CIERRE_CON_FACTURAS_PENDIENTES',
          )
        }

        const ventas = await tx.facturas.aggregate({
          where: { cierre_id: id, estado: { not: 'ANULADA' } },
          _sum: { total: true },
        })

        const pagos = await tx.pagos.groupBy({
          by: ['metodo'],
          where: {
            facturas: {
              is: { cierre_id: id, estado: { not: 'ANULADA' } },
            },
          },
          _sum: { monto: true },
        })

        let totalEfectivo = aDecimal(0)
        let totalOtros = aDecimal(0)

        for (const pago of pagos) {
          const monto = aDecimal(pago._sum.monto ?? 0)

          if (pago.metodo === 'EFECTIVO') {
            totalEfectivo = totalEfectivo.plus(monto)
          } else {
            totalOtros = totalOtros.plus(monto)
          }
        }

        totalEfectivo = redondear(totalEfectivo)
        totalOtros = redondear(totalOtros)

        const totalVentas = redondear(aDecimal(ventas._sum.total ?? 0))
        const efectivoContado = redondear(aDecimal(input.efectivo_contado))
        const efectivoEsperado = redondear(cierre.base_inicial.plus(totalEfectivo))
        const diferencia = redondear(efectivoContado.minus(efectivoEsperado))

        await tx.cierres_caja.update({
          where: { id },
          data: {
            fecha_cierre: new Date(),
            total_ventas: totalVentas,
            total_efectivo: totalEfectivo,
            total_otros: totalOtros,
            efectivo_contado: efectivoContado,
            diferencia,
            estado: 'CERRADO',
            observaciones: input.observaciones ?? cierre.observaciones,
          },
        })

        await registrarAuditoria(tx, {
          usuarioId: usuario.id,
          accion: 'CIERRE_CERRADO',
          tabla: 'cierres_caja',
          registroId: id,
          detalle: {
            caja_id: cierre.caja_id,
            total_ventas: totalVentas.toString(),
            total_efectivo: totalEfectivo.toString(),
            total_otros: totalOtros.toString(),
            efectivo_contado: efectivoContado.toString(),
            diferencia: diferencia.toString(),
          },
          ip,
        })

        const cerrado = await tx.cierres_caja.findUniqueOrThrow({
          where: { id },
          include: cierreInclude,
        })

        return toCierreDTO(cerrado)
      },
      { timeout: 15000 },
    )
  } catch (error) {
    if (esNoEncontrado(error)) {
      throw new HttpError(404, 'Cierre no encontrado', 'NOT_FOUND')
    }
    throw error
  }
}
