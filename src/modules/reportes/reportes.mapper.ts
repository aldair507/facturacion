export interface PeriodoReporte {
  desde: string
  hasta: string
}

export interface ResumenReporteDTO extends PeriodoReporte {
  facturas: number
  facturado: string
  cobrado: string
  pendiente: string
  ticket_promedio: string
}

export interface VentaReporteDTO {
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

export interface MetodoPagoReporteDTO {
  metodo: string
  pagos: number
  total: string
}

export interface ProductoReporteDTO {
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

export interface CierreReporteDTO {
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
