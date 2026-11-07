import { z } from 'zod'

export const paginacionSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
})

export interface Paginacion {
  page: number
  limit: number
}

export interface MetaPaginacion {
  page: number
  limit: number
  total: number
  totalPages: number
}

export function crearMeta({ page, limit }: Paginacion, total: number): MetaPaginacion {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
  }
}

export function calcularSkip({ page, limit }: Paginacion): number {
  return (page - 1) * limit
}
