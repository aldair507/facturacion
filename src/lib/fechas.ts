const MILISEGUNDOS_DIA = 24 * 60 * 60 * 1000

export function diaSiguiente(fecha: Date): Date {
  return new Date(fecha.getTime() + MILISEGUNDOS_DIA)
}

export function rangoMesActual(): { desde: Date; hasta: Date } {
  const ahora = new Date()
  const desde = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), 1))
  const hasta = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate()))

  return { desde, hasta }
}
