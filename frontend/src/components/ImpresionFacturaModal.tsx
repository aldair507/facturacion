import { createPortal } from 'react-dom'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingBlock } from './Feedback'
import { Modal } from './Modal'
import { TicketFactura } from './TicketFactura'
import { removePendingPrint } from '../lib/pending-prints'
import { useResource } from '../lib/hooks'
import type { FacturaDetalle } from '../types'

export function ImpresionFacturaModal({
  facturaId,
  facturaInicial,
  recibido,
  cambio,
  metodo,
  onClose,
}: {
  facturaId: string
  facturaInicial?: FacturaDetalle
  recibido?: string
  cambio?: string
  metodo?: string
  onClose: () => void
}) {
  const { user } = useAuth()
  const consulta = useResource<{ data: FacturaDetalle }>(
    facturaInicial ? null : `/facturas/${facturaId}`,
  )
  const factura = facturaInicial ?? consulta.data?.data
  const anulada = factura?.estado === 'ANULADA'

  const quitarPendiente = () => {
    if (user) removePendingPrint(facturaId, user.id)
  }

  const imprimir = () => {
    window.print()
    quitarPendiente()
    onClose()
  }

  const descartar = () => {
    quitarPendiente()
    onClose()
  }

  return (
    <>
      <Modal
        title={factura ? `Imprimir ${factura.numero_completo}` : 'Imprimir factura'}
        onClose={onClose}
        footer={
          <>
            <button type="button" className="button ghost" onClick={onClose}>
              Cerrar
            </button>
            {anulada ? (
              <button type="button" className="button danger" onClick={descartar}>
                Quitar de pendientes
              </button>
            ) : (
              <button
                type="button"
                className="button primary"
                onClick={imprimir}
                disabled={!factura}
              >
                Imprimir
              </button>
            )}
          </>
        }
      >
        <div className="stack">
          <ErrorBanner message={consulta.error} />
          {consulta.loading && !factura ? (
            <LoadingBlock label="Cargando factura..." />
          ) : !factura ? (
            <EmptyState title="Factura no encontrada" />
          ) : (
            <>
              {anulada && (
                <div className="alert error">
                  La factura está anulada. Puedes quitarla de pendientes de impresión.
                </div>
              )}
              <div className="ticket-preview">
                <TicketFactura
                  factura={factura}
                  recibido={recibido}
                  cambio={cambio}
                  metodo={metodo}
                />
              </div>
              {!anulada && (
                <p className="muted small-hint">
                  Si cierras sin imprimir, la factura quedará en pendientes.
                </p>
              )}
            </>
          )}
        </div>
      </Modal>

      {factura &&
        createPortal(
          <div className="print-root">
            <TicketFactura factura={factura} recibido={recibido} cambio={cambio} metodo={metodo} />
          </div>,
          document.body,
        )}
    </>
  )
}
