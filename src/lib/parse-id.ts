import { z } from 'zod'

const idSchema = z.string().regex(/^\d+$/, 'ID inválido')

export function parseId(value: unknown): bigint {
  return BigInt(idSchema.parse(value))
}
