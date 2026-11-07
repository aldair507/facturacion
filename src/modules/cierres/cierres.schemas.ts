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

const observacionesSchema = z.string().trim().max(2000).optional()

export const abrirCierreSchema = z.object({
  caja_id: z.coerce.number().int().positive(),
  base_inicial: decimalString(2).default('0'),
  observaciones: observacionesSchema,
})

export const cerrarCierreSchema = z.object({
  efectivo_contado: decimalString(2),
  observaciones: observacionesSchema,
})

export const listarCierresQuerySchema = paginacionSchema.extend({
  caja_id: z.coerce.number().int().positive().optional(),
  estado: z.enum(['ABIERTO', 'CERRADO']).optional(),
})

export type AbrirCierreInput = z.infer<typeof abrirCierreSchema>
export type CerrarCierreInput = z.infer<typeof cerrarCierreSchema>
export type ListarCierresQuery = z.infer<typeof listarCierresQuerySchema>
