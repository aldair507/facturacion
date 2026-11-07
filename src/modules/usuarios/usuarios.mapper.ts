import type { roles, usuarios } from '../../generated/prisma/client.js'

export interface UsuarioDTO {
  id: string
  nombre: string
  email: string
  rol: string
  activo: boolean
  ultimo_acceso: string | null
  creado_en: string
  actualizado_en: string
}

type UsuarioConRol = usuarios & { roles: roles }

export function toUsuarioDTO(usuario: UsuarioConRol): UsuarioDTO {
  return {
    id: usuario.id.toString(),
    nombre: usuario.nombre,
    email: usuario.email,
    rol: usuario.roles.nombre,
    activo: usuario.activo,
    ultimo_acceso: usuario.ultimo_acceso?.toISOString() ?? null,
    creado_en: usuario.creado_en.toISOString(),
    actualizado_en: usuario.actualizado_en.toISOString(),
  }
}
