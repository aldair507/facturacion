import { prisma } from '../../db/prisma.js'
import { Prisma } from '../../generated/prisma/client.js'
import { registrarAuditoria } from '../../lib/auditoria.js'
import { diaSiguiente } from '../../lib/fechas.js'
import { HttpError } from '../../lib/http-error.js'
import { aDecimal, redondear } from '../../lib/money.js'
import { calcularSkip, crearMeta, type MetaPaginacion } from '../../lib/pagination.js'
import { esViolacionCheck } from '../../lib/prisma-errors.js'
import {
  type KardexMovimientoDTO,
  type MovimientoConRelaciones,
  type MovimientoInventarioDTO,
  type StockBajoDTO,
  type ValorizacionDTO,
} from './inventario.mapper.js'
import type {
  CrearMovimientoInventarioInput,
  KardexQuery,
  ListarMovimientosQuery,
  ListarStockBajoQuery,
} from './inventario.schemas.js'

const movimientoInclude = {
  productos: { select: { id: true, codigo: true, nombre: true } },
  usuarios: { select: { id: true, nombre: true } },
  facturas: { select: { id: true, prefijo: true, numero: true } },
} satisfies Prisma.inventario_movimientosInclude

interface ProductoBloqueado {
  id: bigint
  codigo: string
  nombre: string
  stock: Prisma.Decimal
  costo: Prisma.Decimal
  activo: boolean
}

interface KardexRaw {
  id: bigint
  tipo: string
  cantidad: Prisma.Decimal
  saldo: Prisma.Decimal
  costo_unitario: Prisma.Decimal
  motivo: string | null
  referencia: string | null
  creado_en: Date
  usuario_id: bigint | null
  usuario_nombre: string | null
  factura_id: bigint | null
  factura_prefijo: string | null
  factura_numero: number | null
}

export interface ListarMovimientosResult {
  data: MovimientoInventarioDTO[]
  meta: MetaPaginacion
}

export interface KardexResult {
  data: KardexMovimientoDTO[]
  meta: MetaPaginacion
}

function toMovimientoDTO(movimiento: MovimientoConRelaciones): MovimientoInventarioDTO {
  return {
    id: movimiento.id.toString(),
    producto: {
      id: movimiento.productos.id.toString(),
      codigo: movimiento.productos.codigo,
      nombre: movimiento.productos.nombre,
    },
    tipo: movimiento.tipo,
    cantidad: movimiento.cantidad.toString(),
    costo_unitario: movimiento.costo_unitario.toString(),
    motivo: movimiento.motivo,
    referencia: movimiento.referencia,
    usuario: movimiento.usuarios
      ? {
          id: movimiento.usuarios.id.toString(),
          nombre: movimiento.usuarios.nombre,
        }
      : null,
    factura: movimiento.facturas
      ? {
          id: movimiento.facturas.id.toString(),
          numero_completo: `${movimiento.facturas.prefijo}-${movimiento.facturas.numero}`,
        }
      : null,
    creado_en: movimiento.creado_en.toISOString(),
  }
}

export async function listarMovimientos(
  params: ListarMovimientosQuery,
): Promise<ListarMovimientosResult> {
  const where: Prisma.inventario_movimientosWhereInput = {}

  if (params.producto_id) {
    where.producto_id = BigInt(params.producto_id)
  }
  if (params.tipo) {
    where.tipo = params.tipo
  }

  const fecha: Prisma.DateTimeFilter = {}
  if (params.desde) {
    fecha.gte = params.desde
  }
  if (params.hasta) {
    fecha.lt = diaSiguiente(params.hasta)
  }
  if (Object.keys(fecha).length > 0) {
    where.creado_en = fecha
  }

  const [total, movimientos] = await prisma.$transaction([
    prisma.inventario_movimientos.count({ where }),
    prisma.inventario_movimientos.findMany({
      where,
      include: movimientoInclude,
      orderBy: { id: 'desc' },
      skip: calcularSkip(params),
      take: params.limit,
    }),
  ])

  return {
    data: movimientos.map(toMovimientoDTO),
    meta: crearMeta(params, total),
  }
}

export async function crearMovimiento(
  input: CrearMovimientoInventarioInput,
  actorId: string,
  ip: string | null = null,
): Promise<MovimientoInventarioDTO> {
  try {
    return await prisma.$transaction(
      async (tx) => {
        const productoId = BigInt(input.producto_id)
        const filas = await tx.$queryRaw<ProductoBloqueado[]>`
          SELECT id, codigo, nombre, stock, costo, activo
          FROM productos
          WHERE id = ${productoId}
          FOR UPDATE
        `

        const producto = filas[0]

        if (!producto) {
          throw new HttpError(404, 'Producto no encontrado', 'PRODUCTO_NO_ENCONTRADO')
        }

        if (!producto.activo) {
          throw new HttpError(409, 'El producto está inactivo', 'PRODUCTO_INACTIVO')
        }

        const cantidad = aDecimal(input.cantidad)
        const stockAntes = aDecimal(producto.stock)
        const stockDespues =
          input.tipo === 'SALIDA' ? stockAntes.minus(cantidad) : stockAntes.plus(cantidad)

        if (stockDespues.lt(0)) {
          throw new HttpError(
            409,
            `Stock insuficiente para el producto ${producto.codigo}`,
            'STOCK_INSUFICIENTE',
          )
        }

        const costoUnitario = input.costo_unitario
          ? aDecimal(input.costo_unitario)
          : aDecimal(producto.costo)

        const creado = await tx.inventario_movimientos.create({
          data: {
            producto_id: productoId,
            tipo: input.tipo,
            cantidad,
            costo_unitario: costoUnitario,
            motivo: input.motivo,
            referencia: input.referencia,
            usuario_id: BigInt(actorId),
          },
        })

        const actualizado = await tx.productos.findUniqueOrThrow({
          where: { id: productoId },
          select: { stock: true },
        })

        const movimiento = await tx.inventario_movimientos.findUniqueOrThrow({
          where: { id: creado.id },
          include: movimientoInclude,
        })

        await registrarAuditoria(tx, {
          usuarioId: actorId,
          accion: 'INVENTARIO_MOVIMIENTO',
          tabla: 'inventario_movimientos',
          registroId: creado.id,
          detalle: {
            producto_id: productoId.toString(),
            tipo: input.tipo,
            cantidad: cantidad.toString(),
            motivo: input.motivo,
            stock_antes: stockAntes.toString(),
            stock_despues: aDecimal(actualizado.stock).toString(),
          },
          ip,
        })

        return toMovimientoDTO(movimiento)
      },
      { timeout: 15000 },
    )
  } catch (error) {
    if (esViolacionCheck(error)) {
      throw new HttpError(409, 'Stock insuficiente para el movimiento', 'STOCK_INSUFICIENTE')
    }
    throw error
  }
}

export async function listarStockBajo(
  params: ListarStockBajoQuery,
): Promise<{ data: StockBajoDTO[]; meta: MetaPaginacion }> {
  const where: Prisma.productosWhereInput = {
    activo: true,
    stock: { lte: prisma.productos.fields.stock_minimo },
  }

  if (params.search) {
    where.OR = [
      { codigo: { contains: params.search, mode: 'insensitive' } },
      { nombre: { contains: params.search, mode: 'insensitive' } },
    ]
  }

  const [total, productos] = await prisma.$transaction([
    prisma.productos.count({ where }),
    prisma.productos.findMany({
      where,
      orderBy: [{ stock: 'asc' }, { id: 'asc' }],
      skip: calcularSkip(params),
      take: params.limit,
    }),
  ])

  return {
    data: productos.map((producto) => {
      const faltante = redondear(producto.stock_minimo.minus(producto.stock))
      const valorCosto = redondear(producto.stock.mul(producto.costo))
      const valorVenta = redondear(producto.stock.mul(producto.precio_venta))

      return {
        id: producto.id.toString(),
        codigo: producto.codigo,
        nombre: producto.nombre,
        unidad: producto.unidad,
        stock: producto.stock.toString(),
        stock_minimo: producto.stock_minimo.toString(),
        faltante: faltante.toString(),
        costo: producto.costo.toString(),
        precio_venta: producto.precio_venta.toString(),
        valor_costo: valorCosto.toString(),
        valor_venta: valorVenta.toString(),
      }
    }),
    meta: crearMeta(params, total),
  }
}

export async function obtenerValorizacion(): Promise<ValorizacionDTO> {
  const filas = await prisma.$queryRaw<
    Array<{
      productos: number
      unidades: Prisma.Decimal
      valor_costo: Prisma.Decimal
      valor_venta: Prisma.Decimal
      stock_bajo: number
    }>
  >`
    SELECT COUNT(*)::int AS productos,
           COALESCE(SUM(stock), 0)          AS unidades,
           COALESCE(SUM(stock * costo), 0)  AS valor_costo,
           COALESCE(SUM(stock * precio_venta), 0) AS valor_venta,
           COUNT(*) FILTER (WHERE stock <= stock_minimo)::int AS stock_bajo
    FROM productos
    WHERE activo = true
  `

  const fila = filas[0]

  if (!fila) {
    return {
      productos: 0,
      unidades: '0',
      valor_costo: '0',
      valor_venta: '0',
      stock_bajo: 0,
    }
  }

  return {
    productos: fila.productos,
    unidades: aDecimal(fila.unidades).toString(),
    valor_costo: redondear(aDecimal(fila.valor_costo)).toString(),
    valor_venta: redondear(aDecimal(fila.valor_venta)).toString(),
    stock_bajo: fila.stock_bajo,
  }
}

export async function obtenerKardex(
  productoId: bigint,
  params: KardexQuery,
): Promise<KardexResult> {
  const producto = await prisma.productos.findUnique({
    where: { id: productoId },
    select: { id: true },
  })

  if (!producto) {
    throw new HttpError(404, 'Producto no encontrado', 'PRODUCTO_NO_ENCONTRADO')
  }

  const filtros: Prisma.Sql[] = []
  if (params.desde) {
    filtros.push(Prisma.sql`m.creado_en >= ${params.desde}`)
  }
  if (params.hasta) {
    filtros.push(Prisma.sql`m.creado_en < ${diaSiguiente(params.hasta)}`)
  }
  const filtro =
    filtros.length > 0 ? Prisma.sql`WHERE ${Prisma.join(filtros, ' AND ')}` : Prisma.empty
  const skip = calcularSkip(params)

  const [filas, totales] = await Promise.all([
    prisma.$queryRaw<KardexRaw[]>`
      WITH movimientos AS (
        SELECT m.id, m.tipo, m.cantidad, m.costo_unitario, m.motivo, m.referencia,
               m.usuario_id, m.factura_id, m.creado_en,
               SUM(CASE WHEN m.tipo = 'SALIDA' THEN -m.cantidad ELSE m.cantidad END)
                 OVER (ORDER BY m.creado_en, m.id) AS saldo
        FROM inventario_movimientos m
        WHERE m.producto_id = ${productoId}
      )
      SELECT m.id, m.tipo::text AS tipo, m.cantidad, m.saldo, m.costo_unitario,
             m.motivo, m.referencia, m.creado_en,
             u.id AS usuario_id, u.nombre AS usuario_nombre,
             f.id AS factura_id, f.prefijo AS factura_prefijo, f.numero AS factura_numero
      FROM movimientos m
      LEFT JOIN usuarios u ON u.id = m.usuario_id
      LEFT JOIN facturas f ON f.id = m.factura_id
      ${filtro}
      ORDER BY m.creado_en DESC, m.id DESC
      LIMIT ${params.limit} OFFSET ${skip}
    `,
    prisma.$queryRaw<Array<{ total: number }>>`
      WITH movimientos AS (
        SELECT m.id, m.creado_en
        FROM inventario_movimientos m
        WHERE m.producto_id = ${productoId}
      )
      SELECT COUNT(*)::int AS total
      FROM movimientos m
      ${filtro}
    `,
  ])

  const total = Number(totales[0]?.total ?? 0)

  return {
    data: filas.map((fila) => ({
      id: fila.id.toString(),
      tipo: fila.tipo,
      cantidad: fila.cantidad.toString(),
      saldo: fila.saldo.toString(),
      costo_unitario: fila.costo_unitario.toString(),
      motivo: fila.motivo,
      referencia: fila.referencia,
      usuario:
        fila.usuario_id !== null && fila.usuario_nombre
          ? {
              id: fila.usuario_id.toString(),
              nombre: fila.usuario_nombre,
            }
          : null,
      factura:
        fila.factura_id !== null && fila.factura_prefijo !== null && fila.factura_numero !== null
          ? {
              id: fila.factura_id.toString(),
              numero_completo: `${fila.factura_prefijo}-${fila.factura_numero}`,
            }
          : null,
      creado_en: fila.creado_en.toISOString(),
    })),
    meta: crearMeta(params, total),
  }
}
