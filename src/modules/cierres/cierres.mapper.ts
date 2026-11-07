import type { cajas, cierres_caja, usuarios } from '../../generated/prisma/client.js'

type CierreConRelaciones = cierres_caja & {
  cajas: Pick<cajas, 'id' | 'nombre'>
  usuarios: Pick<usuarios, 'id' | 'nombre'>
  _count: { facturas: number }
}

export interface CierreDTO {
  id: string
  caja: {
    id: number
    nombre: string
  }
  usuario: {
    id: string
    nombre: string
  }
  fecha_apertura: string
  fecha_cierre: string | null
  base_inicial: string
  total_ventas: string
  total_efectivo: string
  total_otros: string
  efectivo_esperado: string
  efectivo_contado: string | null
  diferencia: string
  estado: string
  observaciones: string | null
  cantidad_facturas: number
}

export function toCierreDTO(cierre: CierreConRelaciones): CierreDTO {
  const esperado = cierre.base_inicial.plus(cierre.total_efectivo)

  return {
    id: cierre.id.toString(),
    caja: {
      id: cierre.cajas.id,
      nombre: cierre.cajas.nombre,
    },
    usuario: {
      id: cierre.usuarios.id.toString(),
      nombre: cierre.usuarios.nombre,
    },
    fecha_apertura: cierre.fecha_apertura.toISOString(),
    fecha_cierre: cierre.fecha_cierre?.toISOString() ?? null,
    base_inicial: cierre.base_inicial.toString(),
    total_ventas: cierre.total_ventas.toString(),
    total_efectivo: cierre.total_efectivo.toString(),
    total_otros: cierre.total_otros.toString(),
    efectivo_esperado: esperado.toString(),
    efectivo_contado: cierre.efectivo_contado?.toString() ?? null,
    diferencia: cierre.diferencia.toString(),
    estado: cierre.estado,
    observaciones: cierre.observaciones,
    cantidad_facturas: cierre._count.facturas,
  }
}
