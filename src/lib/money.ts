import { Prisma } from '../generated/prisma/client.js'

export function aDecimal(value: string | number | Prisma.Decimal): Prisma.Decimal {
  return new Prisma.Decimal(value.toString())
}

export function redondear(valor: Prisma.Decimal, decimales = 2): Prisma.Decimal {
  return valor.toDecimalPlaces(decimales)
}

export function sumar(valores: Prisma.Decimal[]): Prisma.Decimal {
  return valores.reduce((total, valor) => total.plus(valor), new Prisma.Decimal(0))
}
