import { prisma } from '../../db/prisma.js'
import { Prisma } from '../../generated/prisma/client.js'
import { diaSiguiente, rangoMesActual } from '../../lib/fechas.js'
import { HttpError } from '../../lib/http-error.js'
import { aDecimal, redondear } from '../../lib/money.js'
import { calcularSkip, crearMeta, type MetaPaginacion } from '../../lib/pagination.js'
import type {
  CierreReporteDTO,
  MetodoPagoReporteDTO,
  PeriodoReporte,
  ProductoReporteDTO,
  ResumenReporteDTO,
  VentaReporteDTO,
} from './reportes.mapper.js'
import type {
  CierresQuery,
  MetodosPagoQuery,
  ProductosQuery,
  ResumenQuery,
  VentasQuery,
} from './reportes.schemas.js'

interface RangoFechas {
  desde: Date
  hasta: Date
  hastaExclusivo: Date
}

interface FiltrosReporte {
  cajaId?: number
  usuarioId?: bigint
  clienteId?: bigint
}

interface ResumenRaw {
  facturas: number
  facturado: Prisma.Decimal
  cobrado: Prisma.Decimal
  pendiente: Prisma.Decimal
}

interface VentaRaw {
  id: bigint
  prefijo: string
  numero: number
  fecha_emision: Date
  estado: string
  subtotal: Prisma.Decimal
  descuento: Prisma.Decimal
  iva_total: Prisma.Decimal
  total: Prisma.Decimal
  cliente_id: bigint | null
  cliente_num_doc: string | null
  cliente_nombre: string | null
  usuario_id: bigint
  usuario_nombre: string
  caja_id: number | null
  caja_nombre: string | null
  pagado: Prisma.Decimal
  metodos: string | null
}

interface MetodoPagoRaw {
  metodo: string
  pagos: number
  total: Prisma.Decimal
}

interface ProductoRaw {
  producto_id: bigint
  codigo: string
  nombre: string
  cantidad: Prisma.Decimal
  facturas: number
  subtotal: Prisma.Decimal
  iva: Prisma.Decimal
  total: Prisma.Decimal
  costo_estimado: Prisma.Decimal
}

interface CierreRaw {
  id: bigint
  caja_id: number
  caja_nombre: string
  usuario_id: bigint
  usuario_nombre: string
  fecha_apertura: Date
  fecha_cierre: Date | null
  estado: string
  base_inicial: Prisma.Decimal
  total_ventas: Prisma.Decimal
  total_efectivo: Prisma.Decimal
  total_otros: Prisma.Decimal
  efectivo_contado: Prisma.Decimal | null
  diferencia: Prisma.Decimal
  cantidad_facturas: number
}

export interface VentasReporteResult {
  data: VentaReporteDTO[]
  meta: MetaPaginacion
  periodo: PeriodoReporte
}

export interface MetodosPagoReporteResult {
  data: MetodoPagoReporteDTO[]
  periodo: PeriodoReporte
}

export interface ProductosReporteResult {
  data: ProductoReporteDTO[]
  meta: MetaPaginacion
  periodo: PeriodoReporte
}

export interface CierresReporteResult {
  data: CierreReporteDTO[]
  meta: MetaPaginacion
  periodo: PeriodoReporte
}

function resolverRango(params: { desde?: Date; hasta?: Date }): RangoFechas {
  const defecto = rangoMesActual()
  const desde = params.desde ?? defecto.desde
  const hasta = params.hasta ?? (desde.getTime() > defecto.hasta.getTime() ? desde : defecto.hasta)

  if (desde.getTime() > hasta.getTime()) {
    throw new HttpError(422, 'El rango de fechas es inválido', 'RANGO_INVALIDO')
  }

  return {
    desde,
    hasta,
    hastaExclusivo: diaSiguiente(hasta),
  }
}

function obtenerFiltros(params: {
  caja_id?: number
  usuario_id?: string
  cliente_id?: string
}): FiltrosReporte {
  return {
    cajaId: params.caja_id,
    usuarioId: params.usuario_id ? BigInt(params.usuario_id) : undefined,
    clienteId: params.cliente_id ? BigInt(params.cliente_id) : undefined,
  }
}

function filtrosFacturas(rango: RangoFechas, filtros: FiltrosReporte): Prisma.Sql {
  const condiciones: Prisma.Sql[] = [
    Prisma.sql`f.estado <> 'ANULADA'`,
    Prisma.sql`f.fecha_emision >= ${rango.desde}`,
    Prisma.sql`f.fecha_emision < ${rango.hastaExclusivo}`,
  ]

  if (filtros.cajaId !== undefined) {
    condiciones.push(Prisma.sql`f.caja_id = ${filtros.cajaId}`)
  }
  if (filtros.usuarioId !== undefined) {
    condiciones.push(Prisma.sql`f.usuario_id = ${filtros.usuarioId}`)
  }
  if (filtros.clienteId !== undefined) {
    condiciones.push(Prisma.sql`f.cliente_id = ${filtros.clienteId}`)
  }

  return Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
}

function filtrosPagos(rango: RangoFechas, filtros: FiltrosReporte): Prisma.Sql {
  const condiciones: Prisma.Sql[] = [
    Prisma.sql`f.estado <> 'ANULADA'`,
    Prisma.sql`p.fecha >= ${rango.desde}`,
    Prisma.sql`p.fecha < ${rango.hastaExclusivo}`,
  ]

  if (filtros.cajaId !== undefined) {
    condiciones.push(Prisma.sql`f.caja_id = ${filtros.cajaId}`)
  }
  if (filtros.usuarioId !== undefined) {
    condiciones.push(Prisma.sql`f.usuario_id = ${filtros.usuarioId}`)
  }
  if (filtros.clienteId !== undefined) {
    condiciones.push(Prisma.sql`f.cliente_id = ${filtros.clienteId}`)
  }

  return Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
}

function periodo(rango: RangoFechas): PeriodoReporte {
  return {
    desde: rango.desde.toISOString(),
    hasta: rango.hasta.toISOString(),
  }
}

export async function obtenerResumen(params: ResumenQuery): Promise<ResumenReporteDTO> {
  const rango = resolverRango(params)
  const filtros = obtenerFiltros(params)
  const where = filtrosFacturas(rango, filtros)

  const filas = await prisma.$queryRaw<ResumenRaw[]>`
    SELECT COUNT(*)::int AS facturas,
           COALESCE(SUM(f.total), 0) AS facturado,
           COALESCE(SUM(COALESCE(p.pagado, 0)), 0) AS cobrado,
           COALESCE(SUM(f.total - COALESCE(p.pagado, 0)), 0) AS pendiente
    FROM facturas f
    LEFT JOIN LATERAL (
      SELECT SUM(monto) AS pagado
      FROM pagos
      WHERE factura_id = f.id
    ) p ON true
    ${where}
  `

  const fila = filas[0]
  const facturado = redondear(aDecimal(fila?.facturado ?? 0))
  const cobrado = redondear(aDecimal(fila?.cobrado ?? 0))
  const pendiente = redondear(aDecimal(fila?.pendiente ?? 0))
  const facturas = fila?.facturas ?? 0
  const ticketPromedio = facturas > 0 ? redondear(facturado.div(facturas)) : aDecimal(0)

  return {
    ...periodo(rango),
    facturas,
    facturado: facturado.toString(),
    cobrado: cobrado.toString(),
    pendiente: pendiente.toString(),
    ticket_promedio: ticketPromedio.toString(),
  }
}

export async function listarVentas(
  params: VentasQuery,
  paginar = true,
): Promise<VentasReporteResult> {
  const rango = resolverRango(params)
  const filtros = obtenerFiltros(params)
  const where = filtrosFacturas(rango, filtros)
  const skip = paginar ? calcularSkip(params) : 0
  const limite = paginar ? Prisma.sql`LIMIT ${params.limit} OFFSET ${skip}` : Prisma.empty

  const [totales, filas] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS total
      FROM facturas f
      ${where}
    `,
    prisma.$queryRaw<VentaRaw[]>`
      SELECT f.id, f.prefijo, f.numero, f.fecha_emision, f.estado::text AS estado,
             f.subtotal, f.descuento, f.iva_total, f.total,
             c.id AS cliente_id, c.num_doc AS cliente_num_doc,
             c.razon_social AS cliente_nombre,
             u.id AS usuario_id, u.nombre AS usuario_nombre,
             caja.id AS caja_id, caja.nombre AS caja_nombre,
             COALESCE(p.pagado, 0) AS pagado,
             p.metodos
      FROM facturas f
      JOIN usuarios u ON u.id = f.usuario_id
      LEFT JOIN clientes c ON c.id = f.cliente_id
      LEFT JOIN cajas caja ON caja.id = f.caja_id
      LEFT JOIN LATERAL (
        SELECT SUM(monto) AS pagado,
               string_agg(DISTINCT metodo::text, ',') AS metodos
        FROM pagos
        WHERE factura_id = f.id
      ) p ON true
      ${where}
      ORDER BY f.fecha_emision DESC, f.id DESC
      ${limite}
    `,
  ])

  const total = Number(totales[0]?.total ?? 0)

  return {
    data: filas.map((fila) => {
      const pagado = redondear(aDecimal(fila.pagado))
      const totalFactura = redondear(aDecimal(fila.total))
      const saldo = redondear(totalFactura.minus(pagado))

      return {
        id: fila.id.toString(),
        numero_completo: `${fila.prefijo}-${fila.numero}`,
        fecha_emision: fila.fecha_emision.toISOString(),
        estado: fila.estado,
        cliente:
          fila.cliente_id !== null && fila.cliente_num_doc !== null && fila.cliente_nombre !== null
            ? {
                id: fila.cliente_id.toString(),
                num_doc: fila.cliente_num_doc,
                razon_social: fila.cliente_nombre,
              }
            : null,
        usuario: {
          id: fila.usuario_id.toString(),
          nombre: fila.usuario_nombre,
        },
        caja:
          fila.caja_id !== null && fila.caja_nombre !== null
            ? {
                id: fila.caja_id,
                nombre: fila.caja_nombre,
              }
            : null,
        subtotal: fila.subtotal.toString(),
        descuento: fila.descuento.toString(),
        iva_total: fila.iva_total.toString(),
        total: totalFactura.toString(),
        pagado: pagado.toString(),
        saldo_pendiente: saldo.toString(),
        metodos_pago: fila.metodos ? fila.metodos.split(',') : [],
      }
    }),
    meta: crearMeta({ page: params.page, limit: params.limit }, total),
    periodo: periodo(rango),
  }
}

export async function obtenerMetodosPago(
  params: MetodosPagoQuery,
): Promise<MetodosPagoReporteResult> {
  const rango = resolverRango(params)
  const filtros = obtenerFiltros(params)
  const where = filtrosPagos(rango, filtros)

  const filas = await prisma.$queryRaw<MetodoPagoRaw[]>`
    SELECT p.metodo::text AS metodo,
           COUNT(*)::int AS pagos,
           COALESCE(SUM(p.monto), 0) AS total
    FROM pagos p
    JOIN facturas f ON f.id = p.factura_id
    ${where}
    GROUP BY p.metodo
    ORDER BY total DESC, metodo ASC
  `

  return {
    data: filas.map((fila) => ({
      metodo: fila.metodo,
      pagos: fila.pagos,
      total: redondear(aDecimal(fila.total)).toString(),
    })),
    periodo: periodo(rango),
  }
}

export async function listarProductos(
  params: ProductosQuery,
  paginar = true,
): Promise<ProductosReporteResult> {
  const rango = resolverRango(params)
  const filtros = obtenerFiltros(params)
  const where = filtrosFacturas(rango, filtros)
  const skip = paginar ? calcularSkip(params) : 0
  const limite = paginar ? Prisma.sql`LIMIT ${params.limit} OFFSET ${skip}` : Prisma.empty

  const [totales, filas] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(DISTINCT d.producto_id)::int AS total
      FROM detalle_factura d
      JOIN facturas f ON f.id = d.factura_id
      ${where}
      AND d.producto_id IS NOT NULL
    `,
    prisma.$queryRaw<ProductoRaw[]>`
      SELECT p.id AS producto_id, p.codigo, p.nombre,
             SUM(d.cantidad) AS cantidad,
             COUNT(DISTINCT f.id)::int AS facturas,
             SUM(d.subtotal) AS subtotal,
             SUM(d.iva) AS iva,
             SUM(d.total) AS total,
             SUM(d.cantidad * COALESCE((
               SELECT MAX(m.costo_unitario)
               FROM inventario_movimientos m
               WHERE m.factura_id = f.id
                 AND m.producto_id = d.producto_id
                 AND m.tipo = 'SALIDA'
             ), p.costo)) AS costo_estimado
      FROM detalle_factura d
      JOIN facturas f ON f.id = d.factura_id
      JOIN productos p ON p.id = d.producto_id
      ${where}
      AND d.producto_id IS NOT NULL
      GROUP BY p.id, p.codigo, p.nombre, p.costo
      ORDER BY total DESC, p.id ASC
      ${limite}
    `,
  ])

  const total = Number(totales[0]?.total ?? 0)

  return {
    data: filas.map((fila) => {
      const subtotal = redondear(aDecimal(fila.subtotal))
      const costo = redondear(aDecimal(fila.costo_estimado))
      const margen = redondear(subtotal.minus(costo))
      const margenPorcentaje = subtotal.gt(0)
        ? redondear(margen.div(subtotal).mul(100))
        : aDecimal(0)

      return {
        producto_id: fila.producto_id.toString(),
        codigo: fila.codigo,
        nombre: fila.nombre,
        cantidad: aDecimal(fila.cantidad).toString(),
        facturas: fila.facturas,
        subtotal: subtotal.toString(),
        iva: redondear(aDecimal(fila.iva)).toString(),
        total: redondear(aDecimal(fila.total)).toString(),
        costo_estimado: costo.toString(),
        margen_estimado: margen.toString(),
        margen_porcentaje: margenPorcentaje.toString(),
      }
    }),
    meta: crearMeta({ page: params.page, limit: params.limit }, total),
    periodo: periodo(rango),
  }
}

export async function listarCierres(
  params: CierresQuery,
  paginar = true,
): Promise<CierresReporteResult> {
  const rango = resolverRango(params)
  const filtros = obtenerFiltros(params)
  const condiciones: Prisma.Sql[] = [
    Prisma.sql`c.fecha_apertura >= ${rango.desde}`,
    Prisma.sql`c.fecha_apertura < ${rango.hastaExclusivo}`,
  ]

  if (filtros.cajaId !== undefined) {
    condiciones.push(Prisma.sql`c.caja_id = ${filtros.cajaId}`)
  }
  if (filtros.usuarioId !== undefined) {
    condiciones.push(Prisma.sql`c.usuario_id = ${filtros.usuarioId}`)
  }
  if (params.estado) {
    condiciones.push(Prisma.sql`c.estado = ${params.estado}`)
  }

  const where = Prisma.sql`WHERE ${Prisma.join(condiciones, ' AND ')}`
  const skip = paginar ? calcularSkip(params) : 0
  const limite = paginar ? Prisma.sql`LIMIT ${params.limit} OFFSET ${skip}` : Prisma.empty

  const [totales, filas] = await Promise.all([
    prisma.$queryRaw<Array<{ total: number }>>`
      SELECT COUNT(*)::int AS total
      FROM cierres_caja c
      ${where}
    `,
    prisma.$queryRaw<CierreRaw[]>`
      SELECT c.id, c.caja_id, caja.nombre AS caja_nombre,
             c.usuario_id, u.nombre AS usuario_nombre,
             c.fecha_apertura, c.fecha_cierre, c.estado::text AS estado,
             c.base_inicial, c.total_ventas, c.total_efectivo, c.total_otros,
             c.efectivo_contado, c.diferencia,
             COALESCE(fc.cantidad_facturas, 0) AS cantidad_facturas
      FROM cierres_caja c
      JOIN cajas caja ON caja.id = c.caja_id
      JOIN usuarios u ON u.id = c.usuario_id
      LEFT JOIN LATERAL (
        SELECT COUNT(*)::int AS cantidad_facturas
        FROM facturas f
        WHERE f.cierre_id = c.id
          AND f.estado <> 'ANULADA'
      ) fc ON true
      ${where}
      ORDER BY c.fecha_apertura DESC, c.id DESC
      ${limite}
    `,
  ])

  const total = Number(totales[0]?.total ?? 0)

  return {
    data: filas.map((fila) => {
      const baseInicial = aDecimal(fila.base_inicial)
      const totalEfectivo = aDecimal(fila.total_efectivo)
      const esperado = redondear(baseInicial.plus(totalEfectivo))

      return {
        id: fila.id.toString(),
        caja: {
          id: fila.caja_id,
          nombre: fila.caja_nombre,
        },
        usuario: {
          id: fila.usuario_id.toString(),
          nombre: fila.usuario_nombre,
        },
        fecha_apertura: fila.fecha_apertura.toISOString(),
        fecha_cierre: fila.fecha_cierre?.toISOString() ?? null,
        estado: fila.estado,
        base_inicial: baseInicial.toString(),
        total_ventas: aDecimal(fila.total_ventas).toString(),
        total_efectivo: totalEfectivo.toString(),
        total_otros: aDecimal(fila.total_otros).toString(),
        efectivo_esperado: esperado.toString(),
        efectivo_contado: fila.efectivo_contado?.toString() ?? null,
        diferencia: aDecimal(fila.diferencia).toString(),
        cantidad_facturas: fila.cantidad_facturas,
      }
    }),
    meta: crearMeta({ page: params.page, limit: params.limit }, total),
    periodo: periodo(rango),
  }
}
