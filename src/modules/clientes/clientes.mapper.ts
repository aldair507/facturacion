import type { clientes } from '../../generated/prisma/client.js'

export interface ClienteDTO {
  id: string
  tipo_doc: string
  num_doc: string
  razon_social: string
  email: string | null
  direccion: string | null
  telefono: string | null
  regimen: string | null
  responsabilidad_fiscal: string | null
  activo: boolean
  creado_en: string
}

export function toClienteDTO(cliente: clientes): ClienteDTO {
  return {
    id: cliente.id.toString(),
    tipo_doc: cliente.tipo_doc,
    num_doc: cliente.num_doc,
    razon_social: cliente.razon_social,
    email: cliente.email,
    direccion: cliente.direccion,
    telefono: cliente.telefono,
    regimen: cliente.regimen,
    responsabilidad_fiscal: cliente.responsabilidad_fiscal,
    activo: cliente.activo,
    creado_en: cliente.creado_en.toISOString(),
  }
}
