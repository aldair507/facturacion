import { useState } from 'react'
import {
  Badge,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/Feedback'
import { api, toQuery } from '../lib/api'
import {
  formatDate,
  formatDateTime,
  formatMoney,
  formatNumber,
  hoy,
  inicioMes,
} from '../lib/format'
import { useAction, useResource } from '../lib/hooks'
import type {
  CierreReporte,
  MetodoPagoReporte,
  ProductoReporte,
  ResumenReporte,
  VentaReporte,
} from '../types'

type Tab = 'resumen' | 'ventas' | 'metodos' | 'productos' | 'cierres'

interface MetaPeriodo {
  data: VentaReporte[] | ProductoReporte[] | CierreReporte[]
  meta: { page: number; limit: number; total: number; totalPages: number }
  periodo: { desde: string; hasta: string }
}

const tabs: Array<{ id: Tab; label: string }> = [
  { id: 'resumen', label: 'Resumen' },
  { id: 'ventas', label: 'Ventas' },
  { id: 'metodos', label: 'Métodos de pago' },
  { id: 'productos', label: 'Productos' },
  { id: 'cierres', label: 'Cierres' },
]

export function ReportesPage() {
  const [tab, setTab] = useState<Tab>('resumen')
  const [desde, setDesde] = useState(inicioMes())
  const [hasta, setHasta] = useState(hoy())
  const [page, setPage] = useState(1)
  const accion = useAction()

  const filtros = { desde, hasta }
  const paginados = { ...filtros, page, limit: 15 }

  const resumen = useResource<{ data: ResumenReporte }>(
    tab === 'resumen' ? `/reportes/resumen${toQuery(filtros)}` : null,
  )
  const ventas = useResource<MetaPeriodo>(
    tab === 'ventas' ? `/reportes/ventas${toQuery(paginados)}` : null,
  )
  const metodos = useResource<{
    data: MetodoPagoReporte[]
    periodo: { desde: string; hasta: string }
  }>(tab === 'metodos' ? `/reportes/metodos-pago${toQuery(filtros)}` : null)
  const productos = useResource<MetaPeriodo>(
    tab === 'productos' ? `/reportes/productos${toQuery(paginados)}` : null,
  )
  const cierres = useResource<MetaPeriodo>(
    tab === 'cierres' ? `/reportes/cierres${toQuery(paginados)}` : null,
  )

  const error =
    resumen.error ??
    ventas.error ??
    metodos.error ??
    productos.error ??
    cierres.error ??
    accion.error

  const cambiarTab = (nuevo: Tab) => {
    setTab(nuevo)
    setPage(1)
  }

  const exportar = async () => {
    const endpoint =
      tab === 'resumen'
        ? '/reportes/resumen'
        : tab === 'ventas'
          ? '/reportes/ventas'
          : tab === 'metodos'
            ? '/reportes/metodos-pago'
            : tab === 'productos'
              ? '/reportes/productos'
              : '/reportes/cierres'

    await accion.run(() =>
      api.download(endpoint, { ...filtros, format: 'csv' }, `reporte-${tab}-${desde}-${hasta}.csv`),
    )
  }

  return (
    <div className="stack">
      <PageHeader
        title="Reportes"
        subtitle="Consulta y exporta la operación del periodo seleccionado."
        actions={
          <button
            type="button"
            className="button primary"
            onClick={exportar}
            disabled={accion.pending}
          >
            {accion.pending ? 'Exportando...' : 'Exportar CSV'}
          </button>
        }
      />

      <ErrorBanner message={error} />

      <section className="card card-pad">
        <div className="toolbar">
          <label className="row">
            <span className="muted">Desde</span>
            <input
              type="date"
              value={desde}
              onChange={(event) => {
                setDesde(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <label className="row">
            <span className="muted">Hasta</span>
            <input
              type="date"
              value={hasta}
              onChange={(event) => {
                setHasta(event.target.value)
                setPage(1)
              }}
            />
          </label>
          <button
            type="button"
            className="button ghost small"
            onClick={() => {
              setDesde(inicioMes())
              setHasta(hoy())
              setPage(1)
            }}
          >
            Mes actual
          </button>
        </div>
        <div className="tabs">
          {tabs.map((item) => (
            <button
              key={item.id}
              type="button"
              className={tab === item.id ? 'tab active' : 'tab'}
              onClick={() => cambiarTab(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </section>

      {tab === 'resumen' && (
        <section className="stack">
          {resumen.loading ? (
            <LoadingBlock />
          ) : (
            <>
              <div className="stat-grid">
                <div className="stat-card">
                  <span className="label">Facturas</span>
                  <strong className="value">{resumen.data?.data.facturas ?? 0}</strong>
                  <span className="hint">
                    {desde} a {hasta}
                  </span>
                </div>
                <div className="stat-card">
                  <span className="label">Facturado</span>
                  <strong className="value">
                    {formatMoney(resumen.data?.data.facturado ?? 0)}
                  </strong>
                  <span className="hint">Ventas no anuladas</span>
                </div>
                <div className="stat-card">
                  <span className="label">Cobrado</span>
                  <strong className="value">{formatMoney(resumen.data?.data.cobrado ?? 0)}</strong>
                  <span className="hint">Pagos del periodo</span>
                </div>
                <div className="stat-card">
                  <span className="label">Pendiente</span>
                  <strong className="value">
                    {formatMoney(resumen.data?.data.pendiente ?? 0)}
                  </strong>
                  <span className="hint">Saldo por recaudar</span>
                </div>
              </div>
              <section className="card card-pad">
                <div className="summary-box">
                  <div className="summary-line">
                    <span>Periodo consultado</span>
                    <strong>
                      {resumen.data
                        ? `${formatDate(resumen.data.data.desde)} a ${formatDate(
                            resumen.data.data.hasta,
                          )}`
                        : '—'}
                    </strong>
                  </div>
                  <div className="summary-line total">
                    <span>Ticket promedio</span>
                    <strong>{formatMoney(resumen.data?.data.ticket_promedio ?? 0)}</strong>
                  </div>
                </div>
              </section>
            </>
          )}
        </section>
      )}

      {tab === 'ventas' && (
        <section className="card">
          {ventas.loading ? (
            <LoadingBlock />
          ) : ventas.data?.data.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Factura</th>
                      <th>Fecha</th>
                      <th>Cliente</th>
                      <th>Usuario</th>
                      <th>Estado</th>
                      <th className="right">Total</th>
                      <th className="right">Pagado</th>
                      <th className="right">Saldo</th>
                      <th>Métodos</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(ventas.data.data as VentaReporte[]).map((venta) => (
                      <tr key={venta.id}>
                        <td>
                          <strong>{venta.numero_completo}</strong>
                        </td>
                        <td className="nowrap">{formatDateTime(venta.fecha_emision)}</td>
                        <td>{venta.cliente?.razon_social ?? 'Consumidor final'}</td>
                        <td>{venta.usuario.nombre}</td>
                        <td>
                          <Badge
                            tone={
                              venta.estado === 'PAGADA'
                                ? 'success'
                                : venta.estado === 'ANULADA'
                                  ? 'danger'
                                  : 'warning'
                            }
                          >
                            {venta.estado}
                          </Badge>
                        </td>
                        <td className="right">{formatMoney(venta.total)}</td>
                        <td className="right">{formatMoney(venta.pagado)}</td>
                        <td className="right">{formatMoney(venta.saldo_pendiente)}</td>
                        <td>{venta.metodos_pago.join(', ') || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={ventas.data.meta.page}
                totalPages={ventas.data.meta.totalPages}
                onChange={setPage}
              />
            </>
          ) : (
            <EmptyState title="Sin ventas en el periodo" />
          )}
        </section>
      )}

      {tab === 'metodos' && (
        <section className="card">
          {metodos.loading ? (
            <LoadingBlock />
          ) : metodos.data?.data.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Método</th>
                    <th className="right">Pagos</th>
                    <th className="right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {metodos.data.data.map((metodo) => (
                    <tr key={metodo.metodo}>
                      <td>{metodo.metodo}</td>
                      <td className="right">{metodo.pagos}</td>
                      <td className="right">{formatMoney(metodo.total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <EmptyState title="Sin pagos en el periodo" />
          )}
        </section>
      )}

      {tab === 'productos' && (
        <section className="card">
          {productos.loading ? (
            <LoadingBlock />
          ) : productos.data?.data.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Producto</th>
                      <th className="right">Cantidad</th>
                      <th className="right">Facturas</th>
                      <th className="right">Total vendido</th>
                      <th className="right">Costo estimado</th>
                      <th className="right">Margen</th>
                      <th className="right">Margen %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(productos.data.data as ProductoReporte[]).map((producto) => (
                      <tr key={producto.producto_id}>
                        <td>
                          <div className="table-title">
                            <strong>{producto.nombre}</strong>
                            <small>{producto.codigo}</small>
                          </div>
                        </td>
                        <td className="right">{formatNumber(producto.cantidad)}</td>
                        <td className="right">{producto.facturas}</td>
                        <td className="right">{formatMoney(producto.total)}</td>
                        <td className="right">{formatMoney(producto.costo_estimado)}</td>
                        <td className="right">{formatMoney(producto.margen_estimado)}</td>
                        <td className="right">{formatNumber(producto.margen_porcentaje)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={productos.data.meta.page}
                totalPages={productos.data.meta.totalPages}
                onChange={setPage}
              />
            </>
          ) : (
            <EmptyState title="Sin productos vendidos en el periodo" />
          )}
        </section>
      )}

      {tab === 'cierres' && (
        <section className="card">
          {cierres.loading ? (
            <LoadingBlock />
          ) : cierres.data?.data.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Caja</th>
                      <th>Responsable</th>
                      <th>Apertura</th>
                      <th>Cierre</th>
                      <th>Estado</th>
                      <th className="right">Ventas</th>
                      <th className="right">Esperado</th>
                      <th className="right">Contado</th>
                      <th className="right">Diferencia</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(cierres.data.data as CierreReporte[]).map((cierre) => (
                      <tr key={cierre.id}>
                        <td>{cierre.caja.nombre}</td>
                        <td>{cierre.usuario.nombre}</td>
                        <td className="nowrap">{formatDateTime(cierre.fecha_apertura)}</td>
                        <td className="nowrap">
                          {cierre.fecha_cierre ? formatDateTime(cierre.fecha_cierre) : '—'}
                        </td>
                        <td>
                          <Badge tone={cierre.estado === 'ABIERTO' ? 'warning' : 'success'}>
                            {cierre.estado}
                          </Badge>
                        </td>
                        <td className="right">{formatMoney(cierre.total_ventas)}</td>
                        <td className="right">{formatMoney(cierre.efectivo_esperado)}</td>
                        <td className="right">
                          {cierre.efectivo_contado ? formatMoney(cierre.efectivo_contado) : '—'}
                        </td>
                        <td className="right">{formatMoney(cierre.diferencia)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={cierres.data.meta.page}
                totalPages={cierres.data.meta.totalPages}
                onChange={setPage}
              />
            </>
          ) : (
            <EmptyState title="Sin cierres en el periodo" />
          )}
        </section>
      )}
    </div>
  )
}
