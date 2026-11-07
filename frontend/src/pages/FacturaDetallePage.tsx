import { useRef, useState, type FormEvent } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { Badge, EmptyState, ErrorBanner, LoadingBlock, PageHeader } from '../components/Feedback'
import { Field } from '../components/Field'
import { ImpresionFacturaModal } from '../components/ImpresionFacturaModal'
import { Modal } from '../components/Modal'
import { api } from '../lib/api'
import { formatDateTime, formatMoney, formatNumber, valorNumerico } from '../lib/format'
import { useAction, useResource } from '../lib/hooks'
import { useHotkeys } from '../lib/useHotkeys'
import type { FacturaDetalle } from '../types'

const metodosPago = ['EFECTIVO', 'TARJETA', 'TRANSFERENCIA', 'NEQUI', 'DAVIPLATA']

function tonoEstado(estado: string): string {
  if (estado === 'PAGADA') return 'success'
  if (estado === 'ANULADA') return 'danger'
  if (estado === 'EMITIDA') return 'warning'
  return 'neutral'
}

export function FacturaDetallePage() {
  const { id } = useParams()
  const { user } = useAuth()
  const esAdmin = user?.rol === 'ADMIN'
  const path = id ? `/facturas/${id}` : null
  const { data, loading, error, reload } = useResource<{ data: FacturaDetalle }>(path)
  const [pagoModal, setPagoModal] = useState(false)
  const [anularModal, setAnularModal] = useState(false)
  const [impresionModal, setImpresionModal] = useState(false)
  const [metodo, setMetodo] = useState('EFECTIVO')
  const [monto, setMonto] = useState('')
  const [referencia, setReferencia] = useState('')
  const [motivo, setMotivo] = useState('')
  const accion = useAction()
  const pagoKey = useRef(crypto.randomUUID())

  const factura = data?.data
  const pagado = factura?.pagos.reduce((total, pago) => total + valorNumerico(pago.monto), 0) ?? 0
  const saldo = factura ? Math.max(valorNumerico(factura.total) - pagado, 0) : 0

  useHotkeys(
    { p: () => setImpresionModal(true) },
    Boolean(factura) &&
      factura?.estado !== 'ANULADA' &&
      !pagoModal &&
      !anularModal &&
      !impresionModal,
  )

  const abrirPago = () => {
    setMetodo('EFECTIVO')
    setMonto(saldo > 0 ? saldo.toFixed(2) : '')
    setReferencia('')
    accion.setError(null)
    setPagoModal(true)
  }

  const agregarPago = async (event: FormEvent) => {
    event.preventDefault()
    if (!id) return
    const result = await accion.run(() =>
      api.post(
        `/facturas/${id}/pagos`,
        { metodo, monto, referencia: referencia || undefined },
        { 'Idempotency-Key': pagoKey.current },
      ),
    )
    if (result !== undefined) {
      pagoKey.current = crypto.randomUUID()
      setPagoModal(false)
      reload()
    }
  }

  const anular = async (event: FormEvent) => {
    event.preventDefault()
    if (!id) return
    const result = await accion.run(() => api.post(`/facturas/${id}/anular`, { motivo }))
    if (result !== undefined) {
      setAnularModal(false)
      reload()
    }
  }

  return (
    <div className="stack">
      <PageHeader
        title={factura ? `Factura ${factura.numero_completo}` : 'Factura'}
        subtitle="Detalle de productos, pagos y estado del documento."
        actions={
          <>
            <Link className="button ghost" to="/facturas">
              Volver
            </Link>
            {factura && factura.estado !== 'ANULADA' && (
              <button
                type="button"
                className="button ghost"
                onClick={() => setImpresionModal(true)}
              >
                Imprimir (P)
              </button>
            )}
            {factura?.estado === 'EMITIDA' && saldo > 0 && (
              <button type="button" className="button primary" onClick={abrirPago}>
                Registrar pago
              </button>
            )}
            {esAdmin && factura && factura.estado !== 'ANULADA' && (
              <button
                type="button"
                className="button danger"
                onClick={() => {
                  setMotivo('')
                  accion.setError(null)
                  setAnularModal(true)
                }}
              >
                Anular
              </button>
            )}
          </>
        }
      />

      <ErrorBanner message={error ?? accion.error} />

      {loading ? (
        <LoadingBlock />
      ) : !factura ? (
        <EmptyState title="Factura no encontrada" />
      ) : (
        <div className="two-col">
          <div className="stack">
            <section className="card card-pad stack">
              <div className="row">
                <div>
                  <h2>Información general</h2>
                  <p className="muted">
                    Documento generado el {formatDateTime(factura.fecha_emision)}
                  </p>
                </div>
                <span className="spacer" />
                <Badge tone={tonoEstado(factura.estado)}>{factura.estado}</Badge>
              </div>
              <div className="detail-grid">
                <div className="detail-item">
                  <span>Cliente</span>
                  <strong>{factura.cliente?.razon_social ?? 'Consumidor final'}</strong>
                  <small className="muted">
                    {factura.cliente
                      ? `${factura.cliente.tipo_doc} ${factura.cliente.num_doc}`
                      : 'Sin documento'}
                  </small>
                </div>
                <div className="detail-item">
                  <span>Caja</span>
                  <strong>{factura.caja?.nombre ?? 'Sin caja'}</strong>
                  <small className="muted">Cierre {factura.cierre_id ?? 'no asociado'}</small>
                </div>
                <div className="detail-item">
                  <span>Cajero</span>
                  <strong>{factura.usuario.nombre}</strong>
                  <small className="muted">Responsable de la venta</small>
                </div>
              </div>
              {factura.estado === 'ANULADA' && (
                <div className="alert info">
                  Anulada el {factura.anulada_en ? formatDateTime(factura.anulada_en) : '—'} ·{' '}
                  {factura.motivo_anulacion ?? 'Sin motivo registrado'}
                </div>
              )}
            </section>

            <section className="card">
              <header className="card-header">
                <div>
                  <h2>Productos</h2>
                  <p>{factura.items.length} líneas registradas</p>
                </div>
              </header>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="right">Cant.</th>
                      <th className="right">Precio</th>
                      <th className="right">Desc.</th>
                      <th className="right">IVA</th>
                      <th className="right">Total</th>
                    </tr>
                  </thead>
                  <tbody>
                    {factura.items.map((item) => (
                      <tr key={item.id}>
                        <td>
                          <div className="table-title">
                            <strong>{item.descripcion}</strong>
                            <small>{item.codigo}</small>
                          </div>
                        </td>
                        <td className="right">{formatNumber(item.cantidad)}</td>
                        <td className="right">{formatMoney(item.precio_unitario)}</td>
                        <td className="right">{formatMoney(item.descuento)}</td>
                        <td className="right">
                          {formatNumber(item.iva_pct)}% · {formatMoney(item.iva)}
                        </td>
                        <td className="right">{formatMoney(item.total)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>

            <section className="card">
              <header className="card-header">
                <div>
                  <h2>Pagos</h2>
                  <p>Abonos aplicados a la factura</p>
                </div>
              </header>
              {factura.pagos.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Método</th>
                        <th>Fecha</th>
                        <th>Referencia</th>
                        <th className="right">Monto</th>
                      </tr>
                    </thead>
                    <tbody>
                      {factura.pagos.map((pago) => (
                        <tr key={pago.id}>
                          <td>{pago.metodo}</td>
                          <td className="nowrap">{formatDateTime(pago.fecha)}</td>
                          <td>{pago.referencia ?? '—'}</td>
                          <td className="right">{formatMoney(pago.monto)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="Sin pagos registrados" />
              )}
            </section>
          </div>

          <section className="card card-pad stack">
            <h2>Totales</h2>
            <div className="summary-box">
              <div className="summary-line">
                <span>Subtotal</span>
                <strong>{formatMoney(factura.subtotal)}</strong>
              </div>
              <div className="summary-line">
                <span>Descuento</span>
                <strong>-{formatMoney(factura.descuento)}</strong>
              </div>
              <div className="summary-line">
                <span>IVA</span>
                <strong>{formatMoney(factura.iva_total)}</strong>
              </div>
              <div className="summary-line total">
                <span>Total</span>
                <strong>{formatMoney(factura.total)}</strong>
              </div>
            </div>
            <div className="summary-box">
              <div className="summary-line">
                <span>Pagado</span>
                <strong>{formatMoney(pagado)}</strong>
              </div>
              <div className="summary-line total">
                <span>Saldo pendiente</span>
                <strong>{formatMoney(saldo)}</strong>
              </div>
            </div>
            {factura.estado === 'EMITIDA' && saldo > 0 && (
              <button type="button" className="button primary block" onClick={abrirPago}>
                Registrar pago
              </button>
            )}
          </section>
        </div>
      )}

      {pagoModal && (
        <Modal
          title="Registrar pago"
          onClose={() => setPagoModal(false)}
          footer={
            <>
              <button type="button" className="button ghost" onClick={() => setPagoModal(false)}>
                Cancelar
              </button>
              <button
                type="submit"
                form="pago-form"
                className="button primary"
                disabled={accion.pending}
              >
                {accion.pending ? 'Registrando...' : 'Registrar pago'}
              </button>
            </>
          }
        >
          <form id="pago-form" className="stack" onSubmit={agregarPago}>
            <div className="summary-box">
              <div className="summary-line">
                <span>Total factura</span>
                <strong>{factura ? formatMoney(factura.total) : '—'}</strong>
              </div>
              <div className="summary-line total">
                <span>Saldo pendiente</span>
                <strong>{formatMoney(saldo)}</strong>
              </div>
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
            <Field label="Monto">
              <input
                required
                inputMode="decimal"
                value={monto}
                onChange={(event) => setMonto(event.target.value)}
              />
            </Field>
            <Field label="Referencia">
              <input
                maxLength={100}
                value={referencia}
                onChange={(event) => setReferencia(event.target.value)}
              />
            </Field>
            <ErrorBanner message={accion.error} />
          </form>
        </Modal>
      )}

      {impresionModal && factura && (
        <ImpresionFacturaModal
          facturaId={factura.id}
          facturaInicial={factura}
          onClose={() => setImpresionModal(false)}
        />
      )}

      {anularModal && (
        <Modal
          title="Anular factura"
          onClose={() => setAnularModal(false)}
          footer={
            <>
              <button type="button" className="button ghost" onClick={() => setAnularModal(false)}>
                Cancelar
              </button>
              <button
                type="submit"
                form="anular-form"
                className="button danger"
                disabled={accion.pending}
              >
                {accion.pending ? 'Anulando...' : 'Anular factura'}
              </button>
            </>
          }
        >
          <form id="anular-form" className="stack" onSubmit={anular}>
            <div className="alert info">
              La anulación revierte el inventario y deja la factura sin efecto contable.
            </div>
            <Field label="Motivo de anulación" hint="Mínimo 5 caracteres.">
              <textarea
                required
                minLength={5}
                maxLength={200}
                value={motivo}
                onChange={(event) => setMotivo(event.target.value)}
              />
            </Field>
            <ErrorBanner message={accion.error} />
          </form>
        </Modal>
      )}
    </div>
  )
}
