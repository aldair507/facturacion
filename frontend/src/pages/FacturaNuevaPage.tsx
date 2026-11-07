import { useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { CobroModal, type CobroExtra } from '../components/CobroModal'
import {
  Badge,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  Notice,
  PageHeader,
} from '../components/Feedback'
import { Field } from '../components/Field'
import { ImpresionFacturaModal } from '../components/ImpresionFacturaModal'
import { Modal } from '../components/Modal'
import { ProductoBuscador } from '../components/ProductoBuscador'
import { formatDateTime, formatMoney, formatNumber, valorNumerico } from '../lib/format'
import { useAction, useResource } from '../lib/hooks'
import { addPendingPrint } from '../lib/pending-prints'
import { useCajaActual } from '../lib/useCajaActual'
import { useHotkeys } from '../lib/useHotkeys'
import type { Cliente, FacturaDetalle, Paged, Producto } from '../types'

interface LineaForm {
  key: string
  producto: Producto
  cantidad: string
  descuento: string
}

function enfocarCantidad(refs: Map<string, HTMLInputElement>, key: string) {
  window.setTimeout(() => {
    const input = refs.get(key)
    input?.focus()
    input?.select()
  }, 0)
}

export function FacturaNuevaPage() {
  const { user } = useAuth()
  const clientes = useResource<Paged<Cliente>>('/clientes?limit=100&activo=true')
  const cajaActual = useCajaActual()
  const [clienteId, setClienteId] = useState('')
  const [lineas, setLineas] = useState<LineaForm[]>([])
  const [lineaSeleccionada, setLineaSeleccionada] = useState<string | null>(null)
  const [productoModal, setProductoModal] = useState(false)
  const [cobroModal, setCobroModal] = useState(false)
  const [atajosModal, setAtajosModal] = useState(false)
  const [impresion, setImpresion] = useState<{
    factura: FacturaDetalle
    extra: CobroExtra
  } | null>(null)
  const [ultimaFactura, setUltimaFactura] = useState<FacturaDetalle | null>(null)
  const accion = useAction()
  const idempotencyKey = useRef(crypto.randomUUID())
  const cantidadRefs = useRef(new Map<string, HTMLInputElement>())
  const cierre = cajaActual.cierre
  const cajaId = cierre?.caja.id ?? null

  const totales = useMemo(() => {
    return lineas.reduce(
      (acumulado, linea) => {
        const cantidad = valorNumerico(linea.cantidad)
        const precio = valorNumerico(linea.producto.precio_venta)
        const descuento = valorNumerico(linea.descuento)
        const bruto = cantidad * precio
        const subtotal = Math.max(bruto - descuento, 0)
        const iva = subtotal * (valorNumerico(linea.producto.iva_pct) / 100)
        return {
          bruto: acumulado.bruto + bruto,
          descuento: acumulado.descuento + descuento,
          subtotal: acumulado.subtotal + subtotal,
          iva: acumulado.iva + iva,
          total: acumulado.total + subtotal + iva,
        }
      },
      { bruto: 0, descuento: 0, subtotal: 0, iva: 0, total: 0 },
    )
  }, [lineas])

  const items = useMemo(
    () =>
      lineas.map((linea) => ({
        producto_id: linea.producto.id,
        cantidad: linea.cantidad,
        descuento: linea.descuento || '0',
      })),
    [lineas],
  )

  const actualizarLinea = (
    key: string,
    cambios: Partial<Pick<LineaForm, 'cantidad' | 'descuento'>>,
  ) => {
    setLineas((actuales) =>
      actuales.map((linea) => (linea.key === key ? { ...linea, ...cambios } : linea)),
    )
  }

  const quitarLinea = (key: string) => {
    setLineas((actuales) => actuales.filter((linea) => linea.key !== key))
    setLineaSeleccionada((actual) => (actual === key ? null : actual))
    cantidadRefs.current.delete(key)
  }

  const agregarProducto = (producto: Producto) => {
    const existente = lineas.find((linea) => linea.producto.id === producto.id)
    const key = existente?.key ?? crypto.randomUUID()

    setProductoModal(false)

    if (existente) {
      setLineas((actuales) =>
        actuales.map((linea) =>
          linea.key === existente.key
            ? {
                ...linea,
                cantidad: String(Number((valorNumerico(linea.cantidad) + 1).toFixed(3))),
              }
            : linea,
        ),
      )
    } else {
      setLineas((actuales) => [...actuales, { key, producto, cantidad: '1', descuento: '0' }])
    }

    setLineaSeleccionada(key)
    enfocarCantidad(cantidadRefs.current, key)
  }

  const eliminarSeleccionada = () => {
    const key = lineaSeleccionada ?? lineas[lineas.length - 1]?.key
    if (key) quitarLinea(key)
  }

  const abrirCobro = () => {
    accion.setError(null)

    if (!cajaId) {
      accion.setError('No tienes un cierre de caja abierto. Abre uno en Cajas y cierres.')
      return
    }

    if (lineas.length === 0) {
      accion.setError('Agrega al menos un producto antes de cobrar.')
      return
    }

    if (lineas.some((linea) => valorNumerico(linea.cantidad) <= 0)) {
      accion.setError('Todas las cantidades deben ser mayores que cero.')
      return
    }

    if (totales.total <= 0) {
      accion.setError('El total de la factura debe ser mayor que cero.')
      return
    }

    setCobroModal(true)
  }

  useHotkeys(
    {
      n: () => {
        accion.setError(null)
        setProductoModal(true)
      },
      p: abrirCobro,
      Delete: eliminarSeleccionada,
      '?': () => setAtajosModal(true),
    },
    !productoModal && !cobroModal && !impresion && !atajosModal,
  )

  const facturaCreada = (factura: FacturaDetalle, extra: CobroExtra) => {
    setCobroModal(false)
    setImpresion({ factura, extra })
    setUltimaFactura(factura)

    if (user) {
      addPendingPrint({
        facturaId: factura.id,
        numeroCompleto: factura.numero_completo,
        total: factura.total,
        fechaEmision: factura.fecha_emision,
        usuarioId: user.id,
        recibido: extra.recibido,
        cambio: extra.cambio,
        metodo: extra.metodo,
        agregadoEn: new Date().toISOString(),
      })
    }

    setClienteId('')
    setLineas([])
    setLineaSeleccionada(null)
    setProductoModal(false)
    setAtajosModal(false)
    accion.setError(null)
    idempotencyKey.current = crypto.randomUUID()
  }

  const cargando = clientes.loading || cajaActual.loading
  const errorCarga = clientes.error ?? cajaActual.error

  return (
    <div className="stack">
      <PageHeader
        title="Nueva factura"
        subtitle="N agrega producto · P cobra e imprime · Supr elimina la línea seleccionada."
        actions={
          <Link className="button ghost" to="/facturas">
            Volver
          </Link>
        }
      />

      <ErrorBanner message={errorCarga ?? accion.error} />

      {ultimaFactura && (
        <div className="alert success">
          Factura {ultimaFactura.numero_completo} creada correctamente.{' '}
          <Link to={`/facturas/${ultimaFactura.id}`}>Ver detalle</Link>
        </div>
      )}

      {cargando ? (
        <LoadingBlock label="Cargando datos de caja..." />
      ) : (
        <div className="two-col">
          <div className="stack">
            <section className="card card-pad stack section-caja">
              <div className="pos-caja-banner">
                <div>
                  <span className="label">Caja activa</span>
                  <strong>{cierre ? cierre.caja.nombre : 'Sin cierre abierto'}</strong>
                  <small>
                    {cierre
                      ? `Turno abierto ${formatDateTime(cierre.fecha_apertura)}`
                      : 'Abre un cierre para poder facturar'}
                  </small>
                </div>
                <Badge tone={cierre ? 'success' : 'danger'}>
                  {cierre ? 'ABIERTA' : 'SIN CIERRE'}
                </Badge>
              </div>

              {!cierre && (
                <Notice>
                  No tienes un cierre de caja abierto.{' '}
                  <Link to="/cajas">Abrir cierre en Cajas y cierres</Link>.
                </Notice>
              )}

              {cajaActual.multiples && (
                <Notice>
                  Tienes más de un cierre abierto. Se usará el más reciente para esta venta.
                </Notice>
              )}

              <Field label="Cliente">
                <select value={clienteId} onChange={(event) => setClienteId(event.target.value)}>
                  <option value="">Consumidor final</option>
                  {clientes.data?.data.map((cliente) => (
                    <option key={cliente.id} value={cliente.id}>
                      {cliente.razon_social} · {cliente.num_doc}
                    </option>
                  ))}
                </select>
              </Field>
            </section>

            <section className="card section-productos">
              <header className="card-header">
                <div>
                  <h2>Productos</h2>
                  <p>La salida de inventario se registra automáticamente.</p>
                </div>
                <button
                  type="button"
                  className="button primary small"
                  onClick={() => {
                    accion.setError(null)
                    setProductoModal(true)
                  }}
                >
                  Agregar producto <kbd>N</kbd>
                </button>
              </header>

              <div className="card-pad stack">
                {lineas.length === 0 ? (
                  <div className="pos-empty">
                    <EmptyState
                      title="Presiona N para agregar el primer producto"
                      detail="También puedes usar el botón Agregar producto."
                    />
                  </div>
                ) : (
                  <div className="lineas-grid">
                    {lineas.map((linea) => {
                      const cantidad = valorNumerico(linea.cantidad)
                      const precio = valorNumerico(linea.producto.precio_venta)
                      const descuento = valorNumerico(linea.descuento)
                      const subtotal = Math.max(cantidad * precio - descuento, 0)
                      const totalLinea =
                        subtotal * (1 + valorNumerico(linea.producto.iva_pct) / 100)

                      return (
                        <div
                          className={
                            lineaSeleccionada === linea.key ? 'linea-card selected' : 'linea-card'
                          }
                          key={linea.key}
                          onClick={() => setLineaSeleccionada(linea.key)}
                        >
                          <div className="linea-producto">
                            <strong>{linea.producto.nombre}</strong>
                            <small>
                              {linea.producto.codigo} · {formatMoney(linea.producto.precio_venta)} ·
                              stock {formatNumber(linea.producto.stock)}
                            </small>
                          </div>

                          <Field label="Cantidad">
                            <input
                              ref={(element) => {
                                if (element) cantidadRefs.current.set(linea.key, element)
                                else cantidadRefs.current.delete(linea.key)
                              }}
                              required
                              inputMode="decimal"
                              value={linea.cantidad}
                              onFocus={() => setLineaSeleccionada(linea.key)}
                              onChange={(event) =>
                                actualizarLinea(linea.key, {
                                  cantidad: event.target.value,
                                })
                              }
                              onKeyDown={(event) => {
                                if (event.key === 'Enter') {
                                  event.preventDefault()
                                  event.currentTarget.blur()
                                }
                              }}
                            />
                          </Field>

                          <Field label="Descuento">
                            <input
                              inputMode="decimal"
                              value={linea.descuento}
                              onFocus={() => setLineaSeleccionada(linea.key)}
                              onChange={(event) =>
                                actualizarLinea(linea.key, {
                                  descuento: event.target.value,
                                })
                              }
                            />
                          </Field>

                          <div className="linea-total">
                            <strong>{formatMoney(totalLinea)}</strong>
                            <small>IVA {formatMoney(totalLinea - subtotal)}</small>
                          </div>

                          <button
                            type="button"
                            className="icon-button"
                            aria-label="Eliminar línea"
                            onClick={(event) => {
                              event.stopPropagation()
                              quitarLinea(linea.key)
                            }}
                          >
                            ×
                          </button>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="stack">
            <section className="card card-pad stack section-total">
              <div>
                <h2>Resumen</h2>
                <p className="muted">{lineas.length} producto(s) en la factura</p>
              </div>
              <div className="summary-box">
                <div className="summary-line">
                  <span>Bruto</span>
                  <strong>{formatMoney(totales.bruto)}</strong>
                </div>
                <div className="summary-line">
                  <span>Descuento</span>
                  <strong>-{formatMoney(totales.descuento)}</strong>
                </div>
                <div className="summary-line">
                  <span>Subtotal</span>
                  <strong>{formatMoney(totales.subtotal)}</strong>
                </div>
                <div className="summary-line">
                  <span>IVA</span>
                  <strong>{formatMoney(totales.iva)}</strong>
                </div>
                <div className="summary-line total">
                  <span>Total</span>
                  <strong>{formatMoney(totales.total)}</strong>
                </div>
              </div>
              <button
                type="button"
                className="button primary block"
                onClick={abrirCobro}
                disabled={!cierre || lineas.length === 0}
              >
                Cobrar e imprimir <kbd>P</kbd>
              </button>
              <p className="muted small-hint">
                El efectivo recibido y el cambio se calculan antes de emitir la factura.
              </p>
            </section>

            <section className="card card-pad stack section-cliente">
              <div className="row">
                <h2>Atajos</h2>
                <span className="spacer" />
                <button
                  type="button"
                  className="button ghost small"
                  onClick={() => setAtajosModal(true)}
                >
                  Ver todos
                </button>
              </div>
              <div className="hotkeys-compact">
                <span>
                  <kbd>N</kbd> Producto
                </span>
                <span>
                  <kbd>P</kbd> Cobrar
                </span>
                <span>
                  <kbd>Supr</kbd> Eliminar
                </span>
                <span>
                  <kbd>?</kbd> Ayuda
                </span>
              </div>
            </section>
          </div>
        </div>
      )}

      <ProductoBuscador
        open={productoModal}
        onClose={() => setProductoModal(false)}
        onSelect={agregarProducto}
      />

      <CobroModal
        open={cobroModal}
        total={totales.total}
        cajaId={cajaId}
        clienteId={clienteId}
        items={items}
        idempotencyKey={idempotencyKey.current}
        onClose={() => setCobroModal(false)}
        onCreated={facturaCreada}
      />

      {impresion && (
        <ImpresionFacturaModal
          facturaId={impresion.factura.id}
          facturaInicial={impresion.factura}
          recibido={impresion.extra.recibido}
          cambio={impresion.extra.cambio}
          metodo={impresion.extra.metodo}
          onClose={() => setImpresion(null)}
        />
      )}

      {atajosModal && (
        <Modal
          title="Atajos de teclado"
          onClose={() => setAtajosModal(false)}
          footer={
            <button type="button" className="button primary" onClick={() => setAtajosModal(false)}>
              Entendido
            </button>
          }
        >
          <div className="hotkeys-list">
            <div>
              <kbd>N</kbd>
              <span>Buscar y agregar producto</span>
            </div>
            <div>
              <kbd>Enter</kbd>
              <span>Seleccionar producto o confirmar cantidad</span>
            </div>
            <div>
              <kbd>P</kbd>
              <span>Cobrar e imprimir la factura</span>
            </div>
            <div>
              <kbd>Supr</kbd>
              <span>Eliminar la línea seleccionada</span>
            </div>
            <div>
              <kbd>Esc</kbd>
              <span>Cerrar el modal activo</span>
            </div>
            <div>
              <kbd>?</kbd>
              <span>Mostrar esta ayuda</span>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
