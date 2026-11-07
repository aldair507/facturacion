import { formatDateTime, formatMoney, formatNumber } from '../lib/format'
import type { FacturaDetalle } from '../types'

export function TicketFactura({
  factura,
  recibido,
  cambio,
  metodo,
}: {
  factura: FacturaDetalle
  recibido?: string
  cambio?: string
  metodo?: string
}) {
  const metodos = metodo ? [metodo] : [...new Set(factura.pagos.map((pago) => pago.metodo))]

  return (
    <article className="ticket">
      <header className="ticket-header">
        <strong>Facturación</strong>
        <span>Comprobante de venta</span>
      </header>

      <div className="ticket-meta">
        <div>
          <span>Factura</span>
          <strong>{factura.numero_completo}</strong>
        </div>
        <div>
          <span>Fecha</span>
          <strong>{formatDateTime(factura.fecha_emision)}</strong>
        </div>
        <div>
          <span>Cajero</span>
          <strong>{factura.usuario.nombre}</strong>
        </div>
        <div>
          <span>Caja</span>
          <strong>{factura.caja?.nombre ?? 'Sin caja'}</strong>
        </div>
      </div>

      <div className="ticket-cliente">
        <span>Cliente</span>
        <strong>{factura.cliente?.razon_social ?? 'Consumidor final'}</strong>
        <small>{factura.cliente?.num_doc ?? 'Sin documento'}</small>
      </div>

      <div className="ticket-items">
        {factura.items.map((item) => (
          <div className="ticket-item" key={item.id}>
            <div className="ticket-item-titulo">
              <strong>{item.descripcion}</strong>
              <span>{formatMoney(item.total)}</span>
            </div>
            <small>
              {item.codigo} · {formatNumber(item.cantidad)} x {formatMoney(item.precio_unitario)}
            </small>
          </div>
        ))}
      </div>

      <div className="ticket-totales">
        <div>
          <span>Subtotal</span>
          <strong>{formatMoney(factura.subtotal)}</strong>
        </div>
        <div>
          <span>Descuento</span>
          <strong>-{formatMoney(factura.descuento)}</strong>
        </div>
        <div>
          <span>IVA</span>
          <strong>{formatMoney(factura.iva_total)}</strong>
        </div>
        <div className="ticket-total">
          <span>Total</span>
          <strong>{formatMoney(factura.total)}</strong>
        </div>
      </div>

      <div className="ticket-pagos">
        {metodos.map((pago) => (
          <div key={pago}>
            <span>Pago</span>
            <strong>{pago}</strong>
          </div>
        ))}
        {recibido !== undefined && (
          <div>
            <span>Recibido</span>
            <strong>{formatMoney(recibido)}</strong>
          </div>
        )}
        {cambio !== undefined && (
          <div>
            <span>Cambio</span>
            <strong>{formatMoney(cambio)}</strong>
          </div>
        )}
      </div>

      {factura.estado === 'ANULADA' && <div className="ticket-anulada">ANULADA</div>}

      <footer className="ticket-footer">
        <span>Gracias por su compra</span>
      </footer>
    </article>
  )
}
