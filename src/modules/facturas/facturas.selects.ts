import type { Prisma } from '../../generated/prisma/client.js'

export const facturaResumenSelect = {
  id: true,
  prefijo: true,
  numero: true,
  cliente_id: true,
  usuario_id: true,
  caja_id: true,
  cierre_id: true,
  subtotal: true,
  descuento: true,
  iva_total: true,
  total: true,
  estado: true,
  fecha_emision: true,
  anulada_en: true,
  motivo_anulacion: true,
  clientes: {
    select: {
      id: true,
      tipo_doc: true,
      num_doc: true,
      razon_social: true,
    },
  },
  usuarios: {
    select: {
      id: true,
      nombre: true,
    },
  },
  cajas: {
    select: {
      id: true,
      nombre: true,
    },
  },
} satisfies Prisma.facturasSelect

export const facturaDetalleSelect = {
  ...facturaResumenSelect,
  detalle_factura: {
    select: {
      id: true,
      producto_id: true,
      codigo: true,
      descripcion: true,
      cantidad: true,
      precio_unitario: true,
      descuento: true,
      iva_pct: true,
      subtotal: true,
      iva: true,
      total: true,
    },
    orderBy: { id: 'asc' as const },
  },
  pagos: {
    select: {
      id: true,
      metodo: true,
      monto: true,
      referencia: true,
      fecha: true,
    },
    orderBy: { id: 'asc' as const },
  },
} satisfies Prisma.facturasSelect

export type FacturaResumenPayload = Prisma.facturasGetPayload<{
  select: typeof facturaResumenSelect
}>

export type FacturaDetallePayload = Prisma.facturasGetPayload<{
  select: typeof facturaDetalleSelect
}>
