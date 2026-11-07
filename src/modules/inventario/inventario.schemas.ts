import { z } from 'zod'
import { paginacionSchema } from '../../lib/pagination.js'

function decimalString(decimals: number, permitirNegativo = false) {
  const signo = permitirNegativo ? '-?' : ''
  const pattern = new RegExp(`^${signo}\\d+(\\.\\d{1,${decimals}})?$`)

  return z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .refine((value) => pattern.test(value), {
      message: permitirNegativo
        ? `Debe ser un número con máximo ${decimals} decimales`
        : `Debe ser un número positivo con máximo ${decimals} decimales`,
    })
}

const idStringSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+$/.test(value), {
    message: 'ID inválido',
  })

const cantidadPositiva = decimalString(3).refine((value) => Number(value) > 0, {
  message: 'La cantidad debe ser mayor que cero',
})

const cantidadAjuste = decimalString(3, true).refine((value) => Number(value) !== 0, {
  message: 'La cantidad del ajuste no puede ser cero',
})

const movimientoBase = {
  producto_id: idStringSchema,
  costo_unitario: decimalString(2).optional(),
  motivo: z.string().trim().min(5, 'El motivo debe tener al menos 5 caracteres').max(200),
  referencia: z.string().trim().max(100).optional(),
}

export const crearMovimientoInventarioSchema = z.discriminatedUnion('tipo', [
  z.object({
    ...movimientoBase,
    tipo: z.literal('ENTRADA'),
    cantidad: cantidadPositiva,
  }),
  z.object({
    ...movimientoBase,
    tipo: z.literal('SALIDA'),
    cantidad: cantidadPositiva,
  }),
  z.object({
    ...movimientoBase,
    tipo: z.literal('AJUSTE'),
    cantidad: cantidadAjuste,
  }),
])

export const listarMovimientosQuerySchema = paginacionSchema
  .extend({
    producto_id: idStringSchema.optional(),
    tipo: z.enum(['ENTRADA', 'SALIDA', 'AJUSTE']).optional(),
    desde: z.coerce.date().optional(),
    hasta: z.coerce.date().optional(),
  })
  .refine(
    (data) =>
      data.desde === undefined ||
      data.hasta === undefined ||
      data.desde.getTime() <= data.hasta.getTime(),
    { message: 'La fecha inicial no puede ser mayor que la final', path: ['hasta'] },
  )

export const listarStockBajoQuerySchema = paginacionSchema.extend({
  search: z.string().trim().min(1).optional(),
})

export const kardexQuerySchema = z
  .object({
    desde: z.coerce.date().optional(),
    hasta: z.coerce.date().optional(),
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(200).default(50),
  })
  .refine(
    (data) =>
      data.desde === undefined ||
      data.hasta === undefined ||
      data.desde.getTime() <= data.hasta.getTime(),
    { message: 'La fecha inicial no puede ser mayor que la final', path: ['hasta'] },
  )

export type CrearMovimientoInventarioInput = z.infer<typeof crearMovimientoInventarioSchema>
export type ListarMovimientosQuery = z.infer<typeof listarMovimientosQuerySchema>
export type ListarStockBajoQuery = z.infer<typeof listarStockBajoQuerySchema>
export type KardexQuery = z.infer<typeof kardexQuerySchema>
