import { useState, type FormEvent } from 'react'
import {
  Badge,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/Feedback'
import { Field, FieldRow } from '../components/Field'
import { Modal } from '../components/Modal'
import { api, toQuery } from '../lib/api'
import { formatDateTime, formatMoney, formatNumber } from '../lib/format'
import { useAction, useResource } from '../lib/hooks'
import type {
  KardexMovimiento,
  MovimientoInventario,
  Paged,
  Producto,
  StockBajo,
  Valorizacion,
} from '../types'

type Vista = 'movimientos' | 'stock' | 'kardex'

const movimientoVacio = {
  producto_id: '',
  tipo: 'ENTRADA',
  cantidad: '',
  costo_unitario: '',
  motivo: '',
  referencia: '',
}

export function InventarioPage() {
  const [vista, setVista] = useState<Vista>('movimientos')
  const [page, setPage] = useState(1)
  const [tipo, setTipo] = useState('')
  const [productoFiltro, setProductoFiltro] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')
  const [modal, setModal] = useState(false)
  const [form, setForm] = useState(movimientoVacio)
  const [stockSearch, setStockSearch] = useState('')
  const [kardexProducto, setKardexProducto] = useState('')
  const [kardexDesde, setKardexDesde] = useState('')
  const [kardexHasta, setKardexHasta] = useState('')
  const accion = useAction()

  const productos = useResource<Paged<Producto>>('/productos?limit=100&activo=true')
  const valorizacion = useResource<{ data: Valorizacion }>('/inventario/valorizacion')
  const movimientos = useResource<Paged<MovimientoInventario>>(
    `/inventario/movimientos${toQuery({
      page,
      limit: 15,
      tipo,
      producto_id: productoFiltro,
      desde,
      hasta,
    })}`,
  )
  const stockBajo = useResource<Paged<StockBajo>>(
    `/inventario/stock-bajo${toQuery({ page, limit: 15, search: stockSearch })}`,
  )
  const kardex = useResource<Paged<KardexMovimiento>>(
    kardexProducto
      ? `/inventario/productos/${kardexProducto}/kardex${toQuery({
          page,
          limit: 20,
          desde: kardexDesde,
          hasta: kardexHasta,
        })}`
      : null,
  )

  const recargar = () => {
    valorizacion.reload()
    movimientos.reload()
    stockBajo.reload()
    kardex.reload()
  }

  const guardarMovimiento = async (event: FormEvent) => {
    event.preventDefault()
    const result = await accion.run(() =>
      api.post('/inventario/movimientos', {
        producto_id: form.producto_id,
        tipo: form.tipo,
        cantidad: form.cantidad,
        costo_unitario: form.costo_unitario || undefined,
        motivo: form.motivo,
        referencia: form.referencia || undefined,
      }),
    )
    if (result !== undefined) {
      setModal(false)
      setForm(movimientoVacio)
      recargar()
    }
  }

  const abrirMovimiento = () => {
    setForm(movimientoVacio)
    accion.setError(null)
    setModal(true)
  }

  return (
    <div className="stack">
      <PageHeader
        title="Inventario"
        subtitle="Movimientos, existencias mínimas y trazabilidad por producto."
        actions={
          <button type="button" className="button primary" onClick={abrirMovimiento}>
            Registrar movimiento
          </button>
        }
      />

      <ErrorBanner message={valorizacion.error ?? accion.error} />

      <div className="stat-grid">
        <div className="stat-card">
          <span className="label">Productos activos</span>
          <strong className="value">{valorizacion.data?.data.productos ?? 0}</strong>
          <span className="hint">Incluidos en la valorización</span>
        </div>
        <div className="stat-card">
          <span className="label">Unidades</span>
          <strong className="value">{formatNumber(valorizacion.data?.data.unidades ?? 0)}</strong>
          <span className="hint">Stock total disponible</span>
        </div>
        <div className="stat-card">
          <span className="label">Valor a costo</span>
          <strong className="value">{formatMoney(valorizacion.data?.data.valor_costo ?? 0)}</strong>
          <span className="hint">Costo del inventario</span>
        </div>
        <div className="stat-card">
          <span className="label">Stock bajo</span>
          <strong className="value">{valorizacion.data?.data.stock_bajo ?? 0}</strong>
          <span className="hint">Productos bajo el mínimo</span>
        </div>
      </div>

      <div className="tabs">
        <button
          type="button"
          className={vista === 'movimientos' ? 'tab active' : 'tab'}
          onClick={() => {
            setVista('movimientos')
            setPage(1)
          }}
        >
          Movimientos
        </button>
        <button
          type="button"
          className={vista === 'stock' ? 'tab active' : 'tab'}
          onClick={() => {
            setVista('stock')
            setPage(1)
          }}
        >
          Stock bajo
        </button>
        <button
          type="button"
          className={vista === 'kardex' ? 'tab active' : 'tab'}
          onClick={() => {
            setVista('kardex')
            setPage(1)
          }}
        >
          Kardex
        </button>
      </div>

      {vista === 'movimientos' && (
        <section className="card">
          <div className="card-pad">
            <div className="toolbar">
              <select
                value={productoFiltro}
                onChange={(event) => {
                  setProductoFiltro(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todos los productos</option>
                {productos.data?.data.map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.codigo} · {producto.nombre}
                  </option>
                ))}
              </select>
              <select
                value={tipo}
                onChange={(event) => {
                  setTipo(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">Todos los tipos</option>
                <option value="ENTRADA">Entrada</option>
                <option value="SALIDA">Salida</option>
                <option value="AJUSTE">Ajuste</option>
              </select>
              <input
                type="date"
                aria-label="Desde"
                value={desde}
                onChange={(event) => {
                  setDesde(event.target.value)
                  setPage(1)
                }}
              />
              <input
                type="date"
                aria-label="Hasta"
                value={hasta}
                onChange={(event) => {
                  setHasta(event.target.value)
                  setPage(1)
                }}
              />
            </div>

            <ErrorBanner message={movimientos.error} />
            {movimientos.loading ? (
              <LoadingBlock />
            ) : movimientos.data?.data.length ? (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Producto</th>
                        <th>Tipo</th>
                        <th className="right">Cantidad</th>
                        <th className="right">Costo unitario</th>
                        <th>Motivo</th>
                        <th>Origen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {movimientos.data.data.map((movimiento) => (
                        <tr key={movimiento.id}>
                          <td className="nowrap">{formatDateTime(movimiento.creado_en)}</td>
                          <td>
                            <div className="table-title">
                              <strong>{movimiento.producto.nombre}</strong>
                              <small>{movimiento.producto.codigo}</small>
                            </div>
                          </td>
                          <td>
                            <Badge
                              tone={
                                movimiento.tipo === 'ENTRADA'
                                  ? 'success'
                                  : movimiento.tipo === 'SALIDA'
                                    ? 'warning'
                                    : 'primary'
                              }
                            >
                              {movimiento.tipo}
                            </Badge>
                          </td>
                          <td className="right">{formatNumber(movimiento.cantidad)}</td>
                          <td className="right">{formatMoney(movimiento.costo_unitario)}</td>
                          <td>{movimiento.motivo ?? '—'}</td>
                          <td>
                            {movimiento.factura
                              ? `Factura ${movimiento.factura.numero_completo}`
                              : (movimiento.referencia ?? '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={movimientos.data.meta.page}
                  totalPages={movimientos.data.meta.totalPages}
                  onChange={setPage}
                />
              </>
            ) : (
              <EmptyState
                title="Sin movimientos"
                detail="Ajusta los filtros o registra un movimiento."
              />
            )}
          </div>
        </section>
      )}

      {vista === 'stock' && (
        <section className="card">
          <div className="card-pad">
            <div className="toolbar">
              <input
                className="search"
                placeholder="Buscar producto..."
                value={stockSearch}
                onChange={(event) => {
                  setStockSearch(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <ErrorBanner message={stockBajo.error} />
            {stockBajo.loading ? (
              <LoadingBlock />
            ) : stockBajo.data?.data.length ? (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Producto</th>
                        <th className="right">Stock</th>
                        <th className="right">Mínimo</th>
                        <th className="right">Faltante</th>
                        <th className="right">Valor a costo</th>
                        <th className="right">Valor a venta</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stockBajo.data.data.map((producto) => (
                        <tr key={producto.id}>
                          <td>
                            <div className="table-title">
                              <strong>{producto.nombre}</strong>
                              <small>
                                {producto.codigo} · {producto.unidad}
                              </small>
                            </div>
                          </td>
                          <td className="right">{formatNumber(producto.stock)}</td>
                          <td className="right">{formatNumber(producto.stock_minimo)}</td>
                          <td className="right">
                            <Badge tone="warning">{formatNumber(producto.faltante)}</Badge>
                          </td>
                          <td className="right">{formatMoney(producto.valor_costo)}</td>
                          <td className="right">{formatMoney(producto.valor_venta)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={stockBajo.data.meta.page}
                  totalPages={stockBajo.data.meta.totalPages}
                  onChange={setPage}
                />
              </>
            ) : (
              <EmptyState title="Sin productos en stock bajo" />
            )}
          </div>
        </section>
      )}

      {vista === 'kardex' && (
        <section className="card">
          <div className="card-pad">
            <div className="toolbar">
              <select
                value={kardexProducto}
                onChange={(event) => {
                  setKardexProducto(event.target.value)
                  setPage(1)
                }}
              >
                <option value="">Selecciona un producto</option>
                {productos.data?.data.map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.codigo} · {producto.nombre}
                  </option>
                ))}
              </select>
              <input
                type="date"
                aria-label="Desde"
                value={kardexDesde}
                onChange={(event) => {
                  setKardexDesde(event.target.value)
                  setPage(1)
                }}
              />
              <input
                type="date"
                aria-label="Hasta"
                value={kardexHasta}
                onChange={(event) => {
                  setKardexHasta(event.target.value)
                  setPage(1)
                }}
              />
            </div>
            <ErrorBanner message={kardex.error} />
            {!kardexProducto ? (
              <EmptyState
                title="Selecciona un producto"
                detail="Consulta el saldo y los movimientos del kardex."
              />
            ) : kardex.loading ? (
              <LoadingBlock />
            ) : kardex.data?.data.length ? (
              <>
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Fecha</th>
                        <th>Tipo</th>
                        <th className="right">Cantidad</th>
                        <th className="right">Saldo</th>
                        <th className="right">Costo unitario</th>
                        <th>Motivo</th>
                        <th>Origen</th>
                      </tr>
                    </thead>
                    <tbody>
                      {kardex.data.data.map((movimiento) => (
                        <tr key={movimiento.id}>
                          <td className="nowrap">{formatDateTime(movimiento.creado_en)}</td>
                          <td>
                            <Badge
                              tone={
                                movimiento.tipo === 'ENTRADA'
                                  ? 'success'
                                  : movimiento.tipo === 'SALIDA'
                                    ? 'warning'
                                    : 'primary'
                              }
                            >
                              {movimiento.tipo}
                            </Badge>
                          </td>
                          <td className="right">{formatNumber(movimiento.cantidad)}</td>
                          <td className="right">{formatNumber(movimiento.saldo)}</td>
                          <td className="right">{formatMoney(movimiento.costo_unitario)}</td>
                          <td>{movimiento.motivo ?? '—'}</td>
                          <td>
                            {movimiento.factura
                              ? `Factura ${movimiento.factura.numero_completo}`
                              : (movimiento.referencia ?? '—')}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <Pagination
                  page={kardex.data.meta.page}
                  totalPages={kardex.data.meta.totalPages}
                  onChange={setPage}
                />
              </>
            ) : (
              <EmptyState title="Sin movimientos para el producto" />
            )}
          </div>
        </section>
      )}

      {modal && (
        <Modal
          title="Registrar movimiento de inventario"
          onClose={() => setModal(false)}
          footer={
            <>
              <button type="button" className="button ghost" onClick={() => setModal(false)}>
                Cancelar
              </button>
              <button
                type="submit"
                form="movimiento-form"
                className="button primary"
                disabled={accion.pending}
              >
                {accion.pending ? 'Registrando...' : 'Registrar'}
              </button>
            </>
          }
        >
          <form id="movimiento-form" className="form-grid" onSubmit={guardarMovimiento}>
            <Field label="Producto" className="full">
              <select
                required
                value={form.producto_id}
                onChange={(event) => setForm({ ...form, producto_id: event.target.value })}
              >
                <option value="">Seleccionar producto</option>
                {productos.data?.data.map((producto) => (
                  <option key={producto.id} value={producto.id}>
                    {producto.codigo} · {producto.nombre} · stock {producto.stock}
                  </option>
                ))}
              </select>
            </Field>
            <FieldRow className="full">
              <Field label="Tipo">
                <select
                  value={form.tipo}
                  onChange={(event) => setForm({ ...form, tipo: event.target.value })}
                >
                  <option value="ENTRADA">Entrada</option>
                  <option value="SALIDA">Salida</option>
                  <option value="AJUSTE">Ajuste</option>
                </select>
              </Field>
              <Field
                label="Cantidad"
                hint={form.tipo === 'AJUSTE' ? 'Puede ser negativa.' : 'Debe ser mayor que cero.'}
              >
                <input
                  required
                  inputMode="decimal"
                  value={form.cantidad}
                  onChange={(event) => setForm({ ...form, cantidad: event.target.value })}
                />
              </Field>
            </FieldRow>
            <FieldRow className="full">
              <Field label="Costo unitario" hint="Opcional; usa el costo actual del producto.">
                <input
                  inputMode="decimal"
                  value={form.costo_unitario}
                  onChange={(event) => setForm({ ...form, costo_unitario: event.target.value })}
                />
              </Field>
              <Field label="Referencia">
                <input
                  maxLength={100}
                  value={form.referencia}
                  onChange={(event) => setForm({ ...form, referencia: event.target.value })}
                />
              </Field>
            </FieldRow>
            <Field label="Motivo" className="full" hint="Mínimo 5 caracteres.">
              <textarea
                required
                minLength={5}
                maxLength={200}
                value={form.motivo}
                onChange={(event) => setForm({ ...form, motivo: event.target.value })}
              />
            </Field>
            <div className="full">
              <ErrorBanner message={accion.error} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
