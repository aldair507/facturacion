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

const porcentajeSchema = decimalString(2).refine((value) => Number(value) <= 100, {
  message: 'Debe estar entre 0 y 100',
})

const productoBaseSchema = z.object({
  codigo: z.string().trim().min(1, 'El código es obligatorio').max(40),
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(200),
  descripcion: z.string().trim().max(5000).optional(),
  precio_venta: decimalString(2),
  costo: decimalString(2),
  iva_pct: porcentajeSchema,
  unidad: z.string().trim().min(1).max(20),
  stock_minimo: decimalString(3),
})

export const crearProductoSchema = productoBaseSchema.extend({
  costo: decimalString(2).default('0'),
  iva_pct: porcentajeSchema.default('19'),
  unidad: z.string().trim().min(1).max(20).default('UND'),
  stock_minimo: decimalString(3).default('0'),
  stock_inicial: decimalString(3).default('0'),
})

export const actualizarProductoSchema = productoBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export const listarProductosQuerySchema = paginacionSchema.extend({
  search: z.string().trim().min(1).optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
})

export type CrearProductoInput = z.infer<typeof crearProductoSchema>
export type ActualizarProductoInput = z.infer<typeof actualizarProductoSchema>
export type ListarProductosQuery = z.infer<typeof listarProductosQuerySchema>
