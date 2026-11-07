import type { Prisma } from '../../generated/prisma/client.js'

export interface MovimientoInventarioDTO {
  id: string
  producto: {
    id: string
    codigo: string
    nombre: string
  }
  tipo: string
  cantidad: string
  costo_unitario: string
  motivo: string | null
  referencia: string | null
  usuario: {
    id: string
    nombre: string
  } | null
  factura: {
    id: string
    numero_completo: string
  } | null
  creado_en: string
}

export interface StockBajoDTO {
  id: string
  codigo: string
  nombre: string
  unidad: string
  stock: string
  stock_minimo: string
  faltante: string
  costo: string
  precio_venta: string
  valor_costo: string
  valor_venta: string
}

export interface ValorizacionDTO {
  productos: number
  unidades: string
  valor_costo: string
  valor_venta: string
  stock_bajo: number
}

export interface KardexMovimientoDTO {
  id: string
  tipo: string
  cantidad: string
  saldo: string
  costo_unitario: string
  motivo: string | null
  referencia: string | null
  usuario: {
    id: string
    nombre: string
  } | null
  factura: {
    id: string
    numero_completo: string
  } | null
  creado_en: string
}

export type MovimientoConRelaciones = Prisma.inventario_movimientosGetPayload<{
  include: {
    productos: { select: { id: true; codigo: true; nombre: true } }
    usuarios: { select: { id: true; nombre: true } }
    facturas: { select: { id: true; prefijo: true; numero: true } }
  }
}>
