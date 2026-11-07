import { useEffect, useState, type FormEvent } from 'react'
import { ErrorBanner } from './Feedback'
import { Field } from './Field'
import { Modal } from './Modal'
import { api } from '../lib/api'
import { formatMoney, valorNumerico } from '../lib/format'
import { useAction } from '../lib/hooks'
import type { FacturaDetalle } from '../types'

export interface CobroExtra {
  recibido?: string
  cambio?: string
  metodo: string
}

export interface CobroItem {
  producto_id: string
  cantidad: string
  descuento: string
}

const metodosPago = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'NEQUI', 'DAVIPLATA']

export function CobroModal({
  open,
  total,
  cajaId,
  clienteId,
  items,
  idempotencyKey,
  onClose,
  onCreated,
}: {
  open: boolean
  total: number
  cajaId: number | null
  clienteId: string
  items: CobroItem[]
  idempotencyKey: string
  onClose: () => void
  onCreated: (factura: FacturaDetalle, extra: CobroExtra) => void
}) {
  const [metodo, setMetodo] = useState('EFECTIVO')
  const [recibido, setRecibido] = useState('')
  const [referencia, setReferencia] = useState('')
  const accion = useAction()

  useEffect(() => {
    if (!open) return
    setMetodo('EFECTIVO')
    setRecibido(total.toFixed(2))
    setReferencia('')
    accion.setError(null)
  }, [open, total, accion.setError])

  if (!open) return null

  const esEfectivo = metodo === 'EFECTIVO'
  const recibidoNumero = valorNumerico(recibido)
  const cambio = Math.max(recibidoNumero - total, 0)
  const faltante = Math.max(total - recibidoNumero, 0)
  const puedeConfirmar = total > 0 && cajaId !== null && (!esEfectivo || recibidoNumero >= total)

  const emitir = async (event: FormEvent) => {
    event.preventDefault()

    if (!cajaId) {
      accion.setError('No tienes un cierre de caja abierto.')
      return
    }

    if (!puedeConfirmar) {
      accion.setError(
        esEfectivo
          ? 'El efectivo recibido debe cubrir el total de la factura.'
          : 'Agrega al menos un producto para cobrar.',
      )
      return
    }

    const response = await accion.run(() =>
      api.post<{ data: FacturaDetalle }>(
        '/facturas',
        {
          cliente_id: clienteId || undefined,
          caja_id: cajaId,
          items,
          pagos: [
            {
              metodo,
              monto: total.toFixed(2),
              referencia: referencia || undefined,
            },
          ],
        },
        { 'Idempotency-Key': idempotencyKey },
      ),
    )

    if (response) {
      onCreated(response.data, {
        recibido: esEfectivo ? recibidoNumero.toFixed(2) : undefined,
        cambio: esEfectivo ? cambio.toFixed(2) : undefined,
        metodo,
      })
    }
  }

  return (
    <Modal
      title="Cobrar factura"
      onClose={onClose}
      footer={
        <>
          <button type="button" className="button ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            type="submit"
            form="cobro-form"
            className="button primary"
            disabled={!puedeConfirmar || accion.pending}
          >
            {accion.pending ? 'Emitiendo...' : 'Emitir e imprimir'}
          </button>
        </>
      }
    >
      <form id="cobro-form" className="stack cobro-form" onSubmit={emitir}>
        <div className="cobro-total">
          <span>Total a pagar</span>
          <strong>{formatMoney(total)}</strong>
        </div>

        <Field label="Método de pago">
          <select value={metodo} onChange={(event) => setMetodo(event.target.value)}>
            {metodosPago.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </Field>

        {esEfectivo ? (
          <>
            <Field label="Efectivo recibido">
              <input
                autoFocus
                required
                inputMode="decimal"
                value={recibido}
                onChange={(event) => setRecibido(event.target.value)}
              />
            </Field>
            <div className="cobro-resumen">
              <div>
                <span>Cambio</span>
                <strong>{formatMoney(cambio)}</strong>
              </div>
              {faltante > 0 && (
                <div className="cobro-faltante">
                  <span>Falta</span>
                  <strong>{formatMoney(faltante)}</strong>
                </div>
              )}
            </div>
          </>
        ) : (
          <Field label="Referencia" hint="Opcional para pagos electrónicos.">
            <input
              maxLength={100}
              value={referencia}
              onChange={(event) => setReferencia(event.target.value)}
            />
          </Field>
        )}

        <ErrorBanner message={accion.error} />
      </form>
    </Modal>
  )
}
