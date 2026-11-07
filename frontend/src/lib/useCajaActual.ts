import { useMemo } from 'react'
import { useAuth } from '../auth/AuthContext'
import type { Cierre, Paged } from '../types'
import { useResource } from './hooks'

export function useCajaActual() {
  const { user } = useAuth()
  const abiertos = useResource<Paged<Cierre>>('/cierres?estado=ABIERTO&limit=100')

  const cierresUsuario = useMemo(() => {
    if (!user) return []

    return [...(abiertos.data?.data ?? [])]
      .filter((cierre) => cierre.usuario.id === user.id)
      .sort((a, b) => b.fecha_apertura.localeCompare(a.fecha_apertura))
  }, [abiertos.data, user])

  return {
    cierre: cierresUsuario[0] ?? null,
    multiples: cierresUsuario.length > 1,
    loading: abiertos.loading,
    error: abiertos.error,
    reload: abiertos.reload,
  }
}
