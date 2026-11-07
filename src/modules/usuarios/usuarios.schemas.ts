import { z } from 'zod'
import { paginacionSchema } from '../../lib/pagination.js'
import { passwordSchema } from '../../lib/password-schema.js'

export const rolUsuarioSchema = z.enum(['ADMIN', 'CAJERO'])

const usuarioBaseSchema = z.object({
  nombre: z.string().trim().min(1, 'El nombre es obligatorio').max(120),
  email: z.string().trim().toLowerCase().email('Email inválido').max(120),
  rol: rolUsuarioSchema,
})

export const crearUsuarioSchema = usuarioBaseSchema.extend({
  password: passwordSchema,
})

export const actualizarUsuarioSchema = usuarioBaseSchema
  .partial()
  .extend({
    activo: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export const restablecerPasswordSchema = z.object({
  password: passwordSchema,
})

export const cambiarPasswordSchema = z.object({
  password_actual: z.string().min(1, 'La contraseña actual es obligatoria').max(200),
  password_nueva: passwordSchema,
})

export const listarUsuariosQuerySchema = paginacionSchema.extend({
  search: z.string().trim().min(1).optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  rol: rolUsuarioSchema.optional(),
})

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>
export type ActualizarUsuarioInput = z.infer<typeof actualizarUsuarioSchema>
export type ListarUsuariosQuery = z.infer<typeof listarUsuariosQuerySchema>
