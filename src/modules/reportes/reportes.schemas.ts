import { z } from 'zod'
import { paginacionSchema } from '../../lib/pagination.js'

const idStringSchema = z
  .union([z.string(), z.number()])
  .transform((value) => String(value))
  .refine((value) => /^\d+$/.test(value), {
    message: 'ID inválido',
  })

const filtrosBase = {
  desde: z.coerce.date().optional(),
  hasta: z.coerce.date().optional(),
  caja_id: z.coerce.number().int().positive().optional(),
  usuario_id: idStringSchema.optional(),
  cliente_id: idStringSchema.optional(),
  format: z.enum(['json', 'csv']).default('json'),
}

function rangoValido(data: { desde?: Date; hasta?: Date }): boolean {
  return (
    data.desde === undefined ||
    data.hasta === undefined ||
    data.desde.getTime() <= data.hasta.getTime()
  )
}

export const resumenQuerySchema = z.object(filtrosBase).refine(rangoValido, {
  message: 'La fecha inicial no puede ser mayor que la final',
  path: ['hasta'],
})

export const ventasQuerySchema = paginacionSchema.extend(filtrosBase).refine(rangoValido, {
  message: 'La fecha inicial no puede ser mayor que la final',
  path: ['hasta'],
})

export const metodosPagoQuerySchema = z.object(filtrosBase).refine(rangoValido, {
  message: 'La fecha inicial no puede ser mayor que la final',
  path: ['hasta'],
})

export const productosQuerySchema = paginacionSchema.extend(filtrosBase).refine(rangoValido, {
  message: 'La fecha inicial no puede ser mayor que la final',
  path: ['hasta'],
})

export const cierresQuerySchema = paginacionSchema
  .extend({
    ...filtrosBase,
    estado: z.enum(['ABIERTO', 'CERRADO']).optional(),
  })
  .refine(rangoValido, {
    message: 'La fecha inicial no puede ser mayor que la final',
    path: ['hasta'],
  })

export type ResumenQuery = z.infer<typeof resumenQuerySchema>
export type VentasQuery = z.infer<typeof ventasQuerySchema>
export type MetodosPagoQuery = z.infer<typeof metodosPagoQuerySchema>
export type ProductosQuery = z.infer<typeof productosQuerySchema>
export type CierresQuery = z.infer<typeof cierresQuerySchema>
