import type { Request, Response } from 'express'
import { enviarCsv, generarCsv, type ColumnaCsv } from '../../lib/csv.js'
import type {
  CierreReporteDTO,
  MetodoPagoReporteDTO,
  ProductoReporteDTO,
  ResumenReporteDTO,
  VentaReporteDTO,
} from './reportes.mapper.js'
import {
  cierresQuerySchema,
  metodosPagoQuerySchema,
  productosQuerySchema,
  resumenQuerySchema,
  ventasQuerySchema,
} from './reportes.schemas.js'
import * as reportesService from './reportes.service.js'

const columnasResumen: ColumnaCsv<ResumenReporteDTO>[] = [
  { encabezado: 'Desde', valor: (fila) => fila.desde },
  { encabezado: 'Hasta', valor: (fila) => fila.hasta },
  { encabezado: 'Facturas', valor: (fila) => fila.facturas },
  { encabezado: 'Facturado', valor: (fila) => fila.facturado },
  { encabezado: 'Cobrado', valor: (fila) => fila.cobrado },
  { encabezado: 'Pendiente', valor: (fila) => fila.pendiente },
  { encabezado: 'Ticket promedio', valor: (fila) => fila.ticket_promedio },
]

const columnasVentas: ColumnaCsv<VentaReporteDTO>[] = [
  { encabezado: 'Factura', valor: (fila) => fila.numero_completo },
  { encabezado: 'Fecha', valor: (fila) => fila.fecha_emision },
  { encabezado: 'Estado', valor: (fila) => fila.estado },
  { encabezado: 'Cliente', valor: (fila) => fila.cliente?.razon_social ?? '' },
  { encabezado: 'Documento', valor: (fila) => fila.cliente?.num_doc ?? '' },
  { encabezado: 'Usuario', valor: (fila) => fila.usuario.nombre },
  { encabezado: 'Caja', valor: (fila) => fila.caja?.nombre ?? '' },
  { encabezado: 'Subtotal', valor: (fila) => fila.subtotal },
  { encabezado: 'Descuento', valor: (fila) => fila.descuento },
  { encabezado: 'IVA', valor: (fila) => fila.iva_total },
  { encabezado: 'Total', valor: (fila) => fila.total },
  { encabezado: 'Pagado', valor: (fila) => fila.pagado },
  { encabezado: 'Saldo pendiente', valor: (fila) => fila.saldo_pendiente },
  { encabezado: 'Metodos de pago', valor: (fila) => fila.metodos_pago.join('; ') },
]

const columnasMetodosPago: ColumnaCsv<MetodoPagoReporteDTO>[] = [
  { encabezado: 'Metodo', valor: (fila) => fila.metodo },
  { encabezado: 'Pagos', valor: (fila) => fila.pagos },
  { encabezado: 'Total', valor: (fila) => fila.total },
]

const columnasProductos: ColumnaCsv<ProductoReporteDTO>[] = [
  { encabezado: 'Codigo', valor: (fila) => fila.codigo },
  { encabezado: 'Producto', valor: (fila) => fila.nombre },
  { encabezado: 'Cantidad', valor: (fila) => fila.cantidad },
  { encabezado: 'Facturas', valor: (fila) => fila.facturas },
  { encabezado: 'Subtotal', valor: (fila) => fila.subtotal },
  { encabezado: 'IVA', valor: (fila) => fila.iva },
  { encabezado: 'Total', valor: (fila) => fila.total },
  { encabezado: 'Costo estimado', valor: (fila) => fila.costo_estimado },
  { encabezado: 'Margen estimado', valor: (fila) => fila.margen_estimado },
  { encabezado: 'Margen %', valor: (fila) => fila.margen_porcentaje },
]

const columnasCierres: ColumnaCsv<CierreReporteDTO>[] = [
  { encabezado: 'Cierre', valor: (fila) => fila.id },
  { encabezado: 'Caja', valor: (fila) => fila.caja.nombre },
  { encabezado: 'Usuario', valor: (fila) => fila.usuario.nombre },
  { encabezado: 'Apertura', valor: (fila) => fila.fecha_apertura },
  { encabezado: 'Cierre', valor: (fila) => fila.fecha_cierre ?? '' },
  { encabezado: 'Estado', valor: (fila) => fila.estado },
  { encabezado: 'Base inicial', valor: (fila) => fila.base_inicial },
  { encabezado: 'Ventas', valor: (fila) => fila.total_ventas },
  { encabezado: 'Efectivo', valor: (fila) => fila.total_efectivo },
  { encabezado: 'Otros metodos', valor: (fila) => fila.total_otros },
  { encabezado: 'Efectivo esperado', valor: (fila) => fila.efectivo_esperado },
  { encabezado: 'Efectivo contado', valor: (fila) => fila.efectivo_contado ?? '' },
  { encabezado: 'Diferencia', valor: (fila) => fila.diferencia },
  { encabezado: 'Facturas', valor: (fila) => fila.cantidad_facturas },
]

function nombreArchivo(nombre: string, desde: string, hasta: string): string {
  return `${nombre}-${desde.slice(0, 10)}-${hasta.slice(0, 10)}.csv`
}

export async function obtenerResumen(req: Request, res: Response): Promise<void> {
  const query = resumenQuerySchema.parse(req.query)
  const data = await reportesService.obtenerResumen(query)

  if (query.format === 'csv') {
    const csv = generarCsv([data], columnasResumen)
    enviarCsv(res, nombreArchivo('resumen', data.desde, data.hasta), csv)
    return
  }

  res.json({ data })
}

export async function listarVentas(req: Request, res: Response): Promise<void> {
  const query = ventasQuerySchema.parse(req.query)
  const result = await reportesService.listarVentas(query, query.format !== 'csv')

  if (query.format === 'csv') {
    const csv = generarCsv(result.data, columnasVentas)
    enviarCsv(res, nombreArchivo('ventas', result.periodo.desde, result.periodo.hasta), csv)
    return
  }

  res.json(result)
}

export async function obtenerMetodosPago(req: Request, res: Response): Promise<void> {
  const query = metodosPagoQuerySchema.parse(req.query)
  const result = await reportesService.obtenerMetodosPago(query)

  if (query.format === 'csv') {
    const csv = generarCsv(result.data, columnasMetodosPago)
    enviarCsv(res, nombreArchivo('metodos-pago', result.periodo.desde, result.periodo.hasta), csv)
    return
  }

  res.json(result)
}

export async function listarProductos(req: Request, res: Response): Promise<void> {
  const query = productosQuerySchema.parse(req.query)
  const result = await reportesService.listarProductos(query, query.format !== 'csv')

  if (query.format === 'csv') {
    const csv = generarCsv(result.data, columnasProductos)
    enviarCsv(res, nombreArchivo('productos', result.periodo.desde, result.periodo.hasta), csv)
    return
  }

  res.json(result)
}

export async function listarCierres(req: Request, res: Response): Promise<void> {
  const query = cierresQuerySchema.parse(req.query)
  const result = await reportesService.listarCierres(query, query.format !== 'csv')

  if (query.format === 'csv') {
    const csv = generarCsv(result.data, columnasCierres)
    enviarCsv(res, nombreArchivo('cierres', result.periodo.desde, result.periodo.hasta), csv)
    return
  }

  res.json(result)
}
