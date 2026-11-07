import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { EmptyState, ErrorBanner, LoadingBlock, PageHeader } from '../components/Feedback'
import { PendientesImpresion } from '../components/PendientesImpresion'
import { useResource } from '../lib/hooks'
import { formatDateTime, formatMoney, formatNumber } from '../lib/format'
import { toQuery } from '../lib/api'
import type { FacturaResumen, Paged, ResumenReporte, Valorizacion } from '../types'

export function DashboardPage() {
  const { user } = useAuth()
  const esAdmin = user?.rol === 'ADMIN'
  const facturasPath = `/facturas${toQuery({ limit: 6 })}`
  const facturas = useResource<Paged<FacturaResumen>>(facturasPath)
  const resumen = useResource<{ data: ResumenReporte }>(esAdmin ? '/reportes/resumen' : null)
  const valorizacion = useResource<{ data: Valorizacion }>(
    esAdmin ? '/inventario/valorizacion' : null,
  )

  return (
    <div className="stack">
      <PageHeader
        title={`Hola, ${user?.nombre ?? ''}`}
        subtitle={
          esAdmin
            ? 'Resumen operativo del mes actual y últimas facturas registradas.'
            : 'Accesos rápidos para tu operación de caja y facturación.'
        }
        actions={
          <Link className="button primary" to="/facturas/nueva">
            Nueva factura
          </Link>
        }
      />

      <PendientesImpresion />

      {esAdmin ? (
        <>
          <ErrorBanner message={resumen.error} />
          {resumen.loading ? (
            <LoadingBlock />
          ) : (
            <div className="stat-grid">
              <div className="stat-card">
                <span className="label">Facturas del mes</span>
                <strong className="value">{resumen.data?.data.facturas ?? 0}</strong>
                <span className="hint">Documentos emitidos</span>
              </div>
              <div className="stat-card">
                <span className="label">Facturado</span>
                <strong className="value">{formatMoney(resumen.data?.data.facturado ?? 0)}</strong>
                <span className="hint">Total vendido en el periodo</span>
              </div>
              <div className="stat-card">
                <span className="label">Cobrado</span>
                <strong className="value">{formatMoney(resumen.data?.data.cobrado ?? 0)}</strong>
                <span className="hint">Pagos recibidos</span>
              </div>
              <div className="stat-card">
                <span className="label">Pendiente</span>
                <strong className="value">{formatMoney(resumen.data?.data.pendiente ?? 0)}</strong>
                <span className="hint">Saldo por recaudar</span>
              </div>
            </div>
          )}

          <div className="two-col">
            <section className="card">
              <header className="card-header">
                <div>
                  <h2>Últimas facturas</h2>
                  <p>Movimientos recientes del sistema</p>
                </div>
                <Link className="button ghost small" to="/facturas">
                  Ver todas
                </Link>
              </header>
              <ErrorBanner message={facturas.error} />
              {facturas.loading ? (
                <LoadingBlock />
              ) : facturas.data?.data.length ? (
                <div className="table-wrap">
                  <table>
                    <thead>
                      <tr>
                        <th>Factura</th>
                        <th>Cliente</th>
                        <th>Estado</th>
                        <th className="right">Total</th>
                        <th>Fecha</th>
                      </tr>
                    </thead>
                    <tbody>
                      {facturas.data.data.map((factura) => (
                        <tr key={factura.id}>
                          <td>
                            <Link to={`/facturas/${factura.id}`}>
                              <strong>{factura.numero_completo}</strong>
                            </Link>
                          </td>
                          <td>{factura.cliente?.razon_social ?? 'Consumidor final'}</td>
                          <td>
                            <span
                              className={
                                factura.estado === 'ANULADA'
                                  ? 'badge danger'
                                  : factura.estado === 'PAGADA'
                                    ? 'badge success'
                                    : 'badge warning'
                              }
                            >
                              {factura.estado}
                            </span>
                          </td>
                          <td className="right">{formatMoney(factura.total)}</td>
                          <td className="nowrap">{formatDateTime(factura.fecha_emision)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <EmptyState title="Todavía no hay facturas" />
              )}
            </section>

            <section className="card card-pad stack">
              <div>
                <h2>Inventario</h2>
                <p className="muted">Estado actual del catálogo</p>
              </div>
              <ErrorBanner message={valorizacion.error} />
              {valorizacion.loading ? (
                <LoadingBlock />
              ) : (
                <>
                  <div className="summary-box">
                    <div className="summary-line">
                      <span>Productos activos</span>
                      <strong>{valorizacion.data?.data.productos ?? 0}</strong>
                    </div>
                    <div className="summary-line">
                      <span>Unidades en stock</span>
                      <strong>{formatNumber(valorizacion.data?.data.unidades ?? 0)}</strong>
                    </div>
                    <div className="summary-line">
                      <span>Valor a costo</span>
                      <strong>{formatMoney(valorizacion.data?.data.valor_costo ?? 0)}</strong>
                    </div>
                    <div className="summary-line total">
                      <span>Stock bajo</span>
                      <strong>{valorizacion.data?.data.stock_bajo ?? 0} productos</strong>
                    </div>
                  </div>
                  <Link className="button ghost block" to="/inventario">
                    Abrir inventario
                  </Link>
                </>
              )}
            </section>
          </div>
        </>
      ) : (
        <>
          <div className="stat-grid">
            <Link className="stat-card" to="/facturas/nueva">
              <span className="label">Facturar</span>
              <strong className="value">Nueva venta</strong>
              <span className="hint">Registrar una factura y sus pagos</span>
            </Link>
            <Link className="stat-card" to="/facturas">
              <span className="label">Facturación</span>
              <strong className="value">Mis facturas</strong>
              <span className="hint">Consultar, cobrar o revisar documentos</span>
            </Link>
            <Link className="stat-card" to="/cajas">
              <span className="label">Caja</span>
              <strong className="value">Abrir o cerrar</strong>
              <span className="hint">Gestionar el turno de caja</span>
            </Link>
            <Link className="stat-card" to="/productos">
              <span className="label">Catálogo</span>
              <strong className="value">Productos</strong>
              <span className="hint">Consultar precios y existencias</span>
            </Link>
          </div>

          <section className="card">
            <header className="card-header">
              <div>
                <h2>Últimas facturas</h2>
                <p>Tus movimientos recientes</p>
              </div>
              <Link className="button ghost small" to="/facturas">
                Ver todas
              </Link>
            </header>
            <ErrorBanner message={facturas.error} />
            {facturas.loading ? (
              <LoadingBlock />
            ) : facturas.data?.data.length ? (
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Factura</th>
                      <th>Cliente</th>
                      <th>Estado</th>
                      <th className="right">Total</th>
                      <th>Fecha</th>
                    </tr>
                  </thead>
                  <tbody>
                    {facturas.data.data.map((factura) => (
                      <tr key={factura.id}>
                        <td>
                          <Link to={`/facturas/${factura.id}`}>
                            <strong>{factura.numero_completo}</strong>
                          </Link>
                        </td>
                        <td>{factura.cliente?.razon_social ?? 'Consumidor final'}</td>
                        <td>
                          <span
                            className={
                              factura.estado === 'ANULADA'
                                ? 'badge danger'
                                : factura.estado === 'PAGADA'
                                  ? 'badge success'
                                  : 'badge warning'
                            }
                          >
                            {factura.estado}
                          </span>
                        </td>
                        <td className="right">{formatMoney(factura.total)}</td>
                        <td className="nowrap">{formatDateTime(factura.fecha_emision)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <EmptyState title="Todavía no hay facturas" />
            )}
          </section>
        </>
      )}
    </div>
  )
}
