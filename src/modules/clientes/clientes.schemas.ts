import { z } from 'zod'
import { paginacionSchema } from '../../lib/pagination.js'

export const tipoDocumentoSchema = z.enum(['CC', 'NIT', 'CE', 'PP', 'TI'])

const clienteBaseSchema = z.object({
  tipo_doc: tipoDocumentoSchema,
  num_doc: z.string().trim().min(1, 'El número de documento es obligatorio').max(20),
  razon_social: z.string().trim().min(1, 'La razón social es obligatoria').max(200),
  email: z.string().trim().toLowerCase().email('Email inválido').max(120).optional(),
  direccion: z.string().trim().max(200).optional(),
  telefono: z.string().trim().max(30).optional(),
  regimen: z.string().trim().max(50).optional(),
  responsabilidad_fiscal: z.string().trim().max(50).optional(),
})

export const crearClienteSchema = clienteBaseSchema.extend({
  tipo_doc: tipoDocumentoSchema.default('CC'),
})

export const actualizarClienteSchema = clienteBaseSchema
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: 'Debe enviar al menos un campo para actualizar',
  })

export const listarClientesQuerySchema = paginacionSchema.extend({
  search: z.string().trim().min(1).optional(),
  activo: z
    .enum(['true', 'false'])
    .optional()
    .transform((value) => (value === undefined ? undefined : value === 'true')),
  tipo_doc: tipoDocumentoSchema.optional(),
})

export type CrearClienteInput = z.infer<typeof crearClienteSchema>
export type ActualizarClienteInput = z.infer<typeof actualizarClienteSchema>
export type ListarClientesQuery = z.infer<typeof listarClientesQuerySchema>
