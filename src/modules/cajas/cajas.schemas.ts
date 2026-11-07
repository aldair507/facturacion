import { z } from 'zod'
import { paginacionSchema } from '../../lib/pagination.js'

const nombreSchema = z.string().trim().min(1, 'El nombre es obligatorio').max(50)

export const crearCajaSchema = z.object({
  nombre: nombreSchema,
})

export const actualizarCajaSchema = z
  .object({
    nombre: nombreSchema.optional(),
    activo: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export const listarCajasQuerySchema = paginacionSchema.extend({
  search: z.string().trim().min(1).optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
})

export type CrearCajaInput = z.infer<typeof crearCajaSchema>
export type ActualizarCajaInput = z.infer<typeof actualizarCajaSchema>
export type ListarCajasQuery = z.infer<typeof listarCajasQuerySchema>
