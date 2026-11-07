import type { cajas, cierres_caja } from '../../generated/prisma/client.js'

type CajaConCierre = cajas & {
  cierres_caja: Array<Pick<cierres_caja, 'id' | 'fecha_apertura' | 'base_inicial'>>
}

export interface CajaDTO {
  id: number
  nombre: string
  activo: boolean
  cierre_abierto: {
    id: string
    fecha_apertura: string
    base_inicial: string
  } | null
}

export function toCajaDTO(caja: CajaConCierre): CajaDTO {
  const cierre = caja.cierres_caja[0]

  return {
    id: caja.id,
    nombre: caja.nombre,
    activo: caja.activo,
    cierre_abierto: cierre
      ? {
          id: cierre.id.toString(),
          fecha_apertura: cierre.fecha_apertura.toISOString(),
          base_inicial: cierre.base_inicial.toString(),
        }
      : null,
  }
}
