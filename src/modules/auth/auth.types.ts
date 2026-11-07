export type RolNombre = 'ADMIN' | 'CAJERO'

export interface AuthUser {
  id: string
  nombre: string
  email: string
  rol: RolNombre
  tokenVersion: number
}

export function esRolNombre(value: unknown): value is RolNombre {
  return value === 'ADMIN' || value === 'CAJERO'
}
