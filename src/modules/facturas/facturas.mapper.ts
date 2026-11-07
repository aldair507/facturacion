import type { FacturaDetallePayload, FacturaResumenPayload } from './facturas.selects.js'

export interface PagoDTO {
  id: string
  metodo: string
  monto: string
  referencia: string | null
  fecha: string
}

export interface DetalleFacturaDTO {
  id: string
  producto_id: string | null
  codigo: string
  descripcion: string
  cantidad: string
  precio_unitario: string
  descuento: string
  iva_pct: string
  subtotal: string
  iva: string
  total: string
}

export interface FacturaResumenDTO {
  id: string
  prefijo: string
  numero: number
  numero_completo: string
  cliente: {
    id: string
    tipo_doc: string
    num_doc: string
    razon_social: string
  } | null
  usuario: {
    id: string
    nombre: string
  }
  caja: {
    id: number
    nombre: string
  } | null
  cierre_id: string | null
  subtotal: string
  descuento: string
  iva_total: string
  total: string
  estado: string
  fecha_emision: string
  anulada_en: string | null
  motivo_anulacion: string | null
}

export interface FacturaDetalleDTO extends FacturaResumenDTO {
  items: DetalleFacturaDTO[]
  pagos: PagoDTO[]
}

export function toFacturaResumenDTO(factura: FacturaResumenPayload): FacturaResumenDTO {
  return {
    id: factura.id.toString(),
    prefijo: factura.prefijo,
    numero: factura.numero,
    numero_completo: `${factura.prefijo}-${factura.numero}`,
    cliente: factura.clientes
      ? {
          id: factura.clientes.id.toString(),
          tipo_doc: factura.clientes.tipo_doc,
          num_doc: factura.clientes.num_doc,
          razon_social: factura.clientes.razon_social,
        }
      : null,
    usuario: {
      id: factura.usuarios.id.toString(),
      nombre: factura.usuarios.nombre,
    },
    caja: factura.cajas
      ? {
          id: factura.cajas.id,
          nombre: factura.cajas.nombre,
        }
      : null,
    cierre_id: factura.cierre_id?.toString() ?? null,
    subtotal: factura.subtotal.toString(),
    descuento: factura.descuento.toString(),
    iva_total: factura.iva_total.toString(),
    total: factura.total.toString(),
    estado: factura.estado,
    fecha_emision: factura.fecha_emision.toISOString(),
    anulada_en: factura.anulada_en?.toISOString() ?? null,
    motivo_anulacion: factura.motivo_anulacion,
  }
}

export function toFacturaDetalleDTO(factura: FacturaDetallePayload): FacturaDetalleDTO {
  return {
    ...toFacturaResumenDTO(factura),
    items: factura.detalle_factura.map((item) => ({
      id: item.id.toString(),
      producto_id: item.producto_id?.toString() ?? null,
      codigo: item.codigo,
      descripcion: item.descripcion,
      cantidad: item.cantidad.toString(),
      precio_unitario: item.precio_unitario.toString(),
      descuento: item.descuento.toString(),
      iva_pct: item.iva_pct.toString(),
      subtotal: item.subtotal.toString(),
      iva: item.iva.toString(),
      total: item.total.toString(),
    })),
    pagos: factura.pagos.map((pago) => ({
      id: pago.id.toString(),
      metodo: pago.metodo,
      monto: pago.monto.toString(),
      referencia: pago.referencia,
      fecha: pago.fecha.toISOString(),
    })),
  }
}
