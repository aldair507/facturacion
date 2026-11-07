import { useCallback, useEffect, useState } from 'react'

export interface PendingPrint {
  facturaId: string
  numeroCompleto: string
  total: string
  fechaEmision: string
  usuarioId: string
  recibido?: string
  cambio?: string
  metodo?: string
  agregadoEn: string
}

const storageKey = 'facturacion:pendientes-impresion:v1'
const changeEvent = 'pending-prints:changed'

function leerTodos(): PendingPrint[] {
  if (typeof window === 'undefined') return []

  try {
    const raw = window.localStorage.getItem(storageKey)
    if (!raw) return []

    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []

    return parsed.filter((item): item is PendingPrint => {
      if (!item || typeof item !== 'object') return false
      const candidato = item as Partial<PendingPrint>
      return (
        typeof candidato.facturaId === 'string' &&
        typeof candidato.numeroCompleto === 'string' &&
        typeof candidato.total === 'string' &&
        typeof candidato.fechaEmision === 'string' &&
        typeof candidato.usuarioId === 'string' &&
        typeof candidato.agregadoEn === 'string'
      )
    })
  } catch {
    return []
  }
}

function guardarTodos(items: PendingPrint[]) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(storageKey, JSON.stringify(items.slice(0, 200)))
  window.dispatchEvent(new Event(changeEvent))
}

export function listPendingPrints(usuarioId: string): PendingPrint[] {
  return leerTodos()
    .filter((item) => item.usuarioId === usuarioId)
    .sort((a, b) => b.agregadoEn.localeCompare(a.agregadoEn))
}

export function addPendingPrint(record: PendingPrint): void {
  const actuales = leerTodos()
  const existente = actuales.find(
    (item) => item.facturaId === record.facturaId && item.usuarioId === record.usuarioId,
  )

  const siguiente = existente
    ? actuales.map((item) =>
        item.facturaId === record.facturaId && item.usuarioId === record.usuarioId
          ? {
              ...item,
              ...record,
              recibido: record.recibido ?? item.recibido,
              cambio: record.cambio ?? item.cambio,
              metodo: record.metodo ?? item.metodo,
            }
          : item,
      )
    : [record, ...actuales]

  guardarTodos(siguiente)
}

export function removePendingPrint(facturaId: string, usuarioId: string): void {
  guardarTodos(
    leerTodos().filter((item) => !(item.facturaId === facturaId && item.usuarioId === usuarioId)),
  )
}

export function clearPendingPrints(usuarioId: string): void {
  guardarTodos(leerTodos().filter((item) => item.usuarioId !== usuarioId))
}

export function subscribePendingPrints(callback: () => void): () => void {
  if (typeof window === 'undefined') return () => undefined

  const handleStorage = (event: StorageEvent) => {
    if (event.key === storageKey) callback()
  }

  window.addEventListener(changeEvent, callback)
  window.addEventListener('storage', handleStorage)

  return () => {
    window.removeEventListener(changeEvent, callback)
    window.removeEventListener('storage', handleStorage)
  }
}

export function usePendingPrints(usuarioId?: string) {
  const [items, setItems] = useState<PendingPrint[]>([])

  const refresh = useCallback(() => {
    setItems(usuarioId ? listPendingPrints(usuarioId) : [])
  }, [usuarioId])

  useEffect(() => {
    refresh()
    return subscribePendingPrints(refresh)
  }, [refresh])

  const remove = useCallback(
    (facturaId: string) => {
      if (!usuarioId) return
      removePendingPrint(facturaId, usuarioId)
    },
    [usuarioId],
  )

  const clear = useCallback(() => {
    if (!usuarioId) return
    clearPendingPrints(usuarioId)
  }, [usuarioId])

  return { items, count: items.length, remove, clear }
}
