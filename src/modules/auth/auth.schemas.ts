import { z } from 'zod'
import { passwordSchema } from '../../lib/password-schema.js'

export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email('Email inválido').max(120),
  password: z.string().min(1, 'La contraseña es obligatoria').max(200),
})

export const cambiarPasswordSchema = z.object({
  password_actual: z.string().min(1, 'La contraseña actual es obligatoria').max(200),
  password_nueva: passwordSchema,
})

export type LoginInput = z.infer<typeof loginSchema>
export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>
