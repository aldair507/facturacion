import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'
import { formatDateTime, formatMoney } from '../lib/format'
import { usePendingPrints, type PendingPrint } from '../lib/pending-prints'
import { Badge } from './Feedback'
import { ImpresionFacturaModal } from './ImpresionFacturaModal'

export function PendientesImpresion() {
  const { user } = useAuth()
  const { items, count, remove, clear } = usePendingPrints(user?.id)
  const [imprimiendo, setImprimiendo] = useState<PendingPrint | null>(null)

  if (count === 0) return null

  return (
    <section className="card section-cobro">
      <header className="card-header">
        <div>
          <h2>Pendientes de imprimir</h2>
          <p>Facturas guardadas en este equipo para imprimir después</p>
        </div>
        <div className="row">
          <Badge tone="warning">{count}</Badge>
          <button
            type="button"
            className="button ghost small"
            onClick={() => {
              if (window.confirm('¿Quitar todas las facturas pendientes de este usuario?')) clear()
            }}
          >
            Limpiar
          </button>
        </div>
      </header>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Factura</th>
              <th>Fecha</th>
              <th className="right">Total</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.facturaId}>
                <td>
                  <strong>{item.numeroCompleto}</strong>
                </td>
                <td className="nowrap">{formatDateTime(item.fechaEmision)}</td>
                <td className="right">{formatMoney(item.total)}</td>
                <td>
                  <div className="table-actions">
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => setImprimiendo(item)}
                    >
                      Imprimir
                    </button>
                    <button
                      type="button"
                      className="button ghost small"
                      onClick={() => remove(item.facturaId)}
                    >
                      Quitar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {imprimiendo && (
        <ImpresionFacturaModal
          facturaId={imprimiendo.facturaId}
          recibido={imprimiendo.recibido}
          cambio={imprimiendo.cambio}
          metodo={imprimiendo.metodo}
          onClose={() => setImprimiendo(null)}
        />
      )}
    </section>
  )
}
