import { z } from 'zod'
import { paginacionSchema } from '../../lib/pagination.js'

function decimalString(decimals: number) {
  const pattern = new RegExp(`^\\d+(\\.\\d{1,${decimals}})?$`)

  return z
    .union([z.string(), z.number()])
    .transform((value) => String(value))
    .refine((value) => pattern.test(value), {
      message: `Debe ser un número positivo con máximo ${decimals} decimales`,
    })
}

const idStringSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+$/.test(value), {
    message: 'ID inválido',
  })

const cantidadSchema = decimalString(3).refine((value) => Number(value) > 0, {
  message: 'La cantidad debe ser mayor que cero',
})

const montoSchema = decimalString(2).refine((value) => Number(value) > 0, {
  message: 'El monto debe ser mayor que cero',
})

const descuentoSchema = decimalString(2)

export const metodoPagoSchema = z.enum([
  'EFECTIVO',
  'TARJETA',
  'TRANSFERENCIA',
  'NEQUI',
  'DAVIPLATA',
])

export const estadoFacturaSchema = z.enum(['BORRADOR', 'EMITIDA', 'PAGADA', 'ANULADA'])

export const itemFacturaSchema = z.object({
  producto_id: idStringSchema,
  cantidad: cantidadSchema,
  descuento: descuentoSchema.default('0'),
})

export const pagoSchema = z.object({
  metodo: metodoPagoSchema,
  monto: montoSchema,
  referencia: z.string().trim().max(100).optional(),
})

export const crearFacturaSchema = z.object({
  cliente_id: idStringSchema.optional(),
  caja_id: z.coerce.number().int().positive().optional(),
  items: z
    .array(itemFacturaSchema)
    .min(1, 'La factura debe tener al menos un producto')
    .refine((items) => new Set(items.map((item) => item.producto_id)).size === items.length, {
      message: 'No se permiten productos duplicados en la factura',
    }),
  pagos: z.array(pagoSchema).default([]),
})

export const agregarPagoSchema = pagoSchema

export const anularFacturaSchema = z.object({
  motivo: z.string().trim().min(5, 'El motivo debe tener al menos 5 caracteres').max(200),
})

export const listarFacturasQuerySchema = paginacionSchema
  .extend({
    estado: estadoFacturaSchema.optional(),
    cliente_id: idStringSchema.optional(),
    caja_id: z.coerce.number().int().positive().optional(),
    numero: z.coerce.number().int().positive().optional(),
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

export type CrearFacturaInput = z.infer<typeof crearFacturaSchema>
export type AgregarPagoInput = z.infer<typeof agregarPagoSchema>
export type ListarFacturasQuery = z.infer<typeof listarFacturasQuerySchema>
