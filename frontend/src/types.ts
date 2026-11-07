export type Rol = 'ADMIN' | 'CAJERO'

export interface AuthUser {
  id: string
  nombre: string
  email: string
  rol: Rol
  tokenVersion: number
}

export interface MetaPaginacion {
  page: number
  limit: number
  total: number
  totalPages: number
}

export interface Paged<T> {
  data: T[]
  meta: MetaPaginacion
}

export interface Producto {
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

export interface Cliente {
  id: string
  tipo_doc: string
  num_doc: string
  razon_social: string
  email: string | null
  direccion: string | null
  telefono: string | null
  regimen: string | null
  responsabilidad_fiscal: string | null
  activo: boolean
  creado_en: string
}

export interface Caja {
  id: number
  nombre: string
  activo: boolean
  cierre_abierto: {
    id: string
    fecha_apertura: string
    base_inicial: string
  } | null
}

export interface Cierre {
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

export interface FacturaResumen {
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

export interface DetalleFacturaItem {
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

export interface Pago {
  id: string
  metodo: string
  monto: string
  referencia: string | null
  fecha: string
}

export interface FacturaDetalle extends FacturaResumen {
  items: DetalleFacturaItem[]
  pagos: Pago[]
}

export interface MovimientoInventario {
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

export interface StockBajo {
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

export interface Valorizacion {
  productos: number
  unidades: string
  valor_costo: string
  valor_venta: string
  stock_bajo: number
}

export interface KardexMovimiento {
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

export interface ResumenReporte {
  desde: string
  hasta: string
  facturas: number
  facturado: string
  cobrado: string
  pendiente: string
  ticket_promedio: string
}

export interface VentaReporte {
  id: string
  numero_completo: string
  fecha_emision: string
  estado: string
  cliente: {
    id: string
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
  subtotal: string
  descuento: string
  iva_total: string
  total: string
  pagado: string
  saldo_pendiente: string
  metodos_pago: string[]
}

export interface MetodoPagoReporte {
  metodo: string
  pagos: number
  total: string
}

export interface ProductoReporte {
  producto_id: string
  codigo: string
  nombre: string
  cantidad: string
  facturas: number
  subtotal: string
  iva: string
  total: string
  costo_estimado: string
  margen_estimado: string
  margen_porcentaje: string
}

export interface CierreReporte {
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
  estado: string
  base_inicial: string
  total_ventas: string
  total_efectivo: string
  total_otros: string
  efectivo_esperado: string
  efectivo_contado: string | null
  diferencia: string
  cantidad_facturas: number
}
