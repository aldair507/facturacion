const moneda = new Intl.NumberFormat('es-CO', {
  style: 'currency',
  currency: 'COP',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

const numero = new Intl.NumberFormat('es-CO', {
  maximumFractionDigits: 3,
})

const fecha = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
})

const fechaHora = new Intl.DateTimeFormat('es-CO', {
  year: 'numeric',
  month: 'short',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
})

export function formatMoney(value: string | number): string {
  return moneda.format(Number(value))
}

export function formatNumber(value: string | number): string {
  return numero.format(Number(value))
}

export function formatDate(value: string): string {
  return fecha.format(new Date(value))
}

export function formatDateTime(value: string): string {
  return fechaHora.format(new Date(value))
}

export function inputDate(value: Date): string {
  const anio = value.getFullYear()
  const mes = String(value.getMonth() + 1).padStart(2, '0')
  const dia = String(value.getDate()).padStart(2, '0')
  return `${anio}-${mes}-${dia}`
}

export function inicioMes(): string {
  const ahora = new Date()
  return inputDate(new Date(ahora.getFullYear(), ahora.getMonth(), 1))
}

export function hoy(): string {
  return inputDate(new Date())
}

export function valorNumerico(value: string): number {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}
