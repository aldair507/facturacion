import type { productos } from '../../generated/prisma/client.js'

export interface ProductoDTO {
  id: string
  codigo: string
  nombre: string
  descripcion: string | null
  precio_venta: string
  costo: string
  iva_pct: string
  unidad: string
  stock: string
  stock_minimo: string
  activo: boolean
  creado_en: string
  actualizado_en: string
}

export function toProductoDTO(producto: productos): ProductoDTO {
  return {
    id: producto.id.toString(),
    codigo: producto.codigo,
    nombre: producto.nombre,
    descripcion: producto.descripcion,
    precio_venta: producto.precio_venta.toString(),
    costo: producto.costo.toString(),
    iva_pct: producto.iva_pct.toString(),
    unidad: producto.unidad,
    stock: producto.stock.toString(),
    stock_minimo: producto.stock_minimo.toString(),
    activo: producto.activo,
    creado_en: producto.creado_en.toISOString(),
    actualizado_en: producto.actualizado_en.toISOString(),
  }
}
