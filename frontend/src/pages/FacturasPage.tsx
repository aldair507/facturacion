import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/Feedback'
import { PendientesImpresion } from '../components/PendientesImpresion'
import { toQuery } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'
import { useResource } from '../lib/hooks'
import type { FacturaResumen, Paged } from '../types'

const estados = ['BORRADOR', 'EMITIDA', 'PAGADA', 'ANULADA']

function tonoEstado(estado: string): string {
  if (estado === 'PAGADA') return 'success'
  if (estado === 'ANULADA') return 'danger'
  if (estado === 'EMITIDA') return 'warning'
  return 'neutral'
}

export function FacturasPage() {
  const [page, setPage] = useState(1)
  const [estado, setEstado] = useState('')
  const [numero, setNumero] = useState('')
  const [desde, setDesde] = useState('')
  const [hasta, setHasta] = useState('')

  const path = `/facturas${toQuery({
    page,
    limit: 15,
    estado,
    numero,
    desde,
    hasta,
  })}`
  const { data, loading, error } = useResource<Paged<FacturaResumen>>(path)

  return (
    <div className="stack">
      <PageHeader
        title="Facturación"
        subtitle="Consulta las facturas emitidas, sus estados y saldos."
        actions={
          <Link className="button primary" to="/facturas/nueva">
            Nueva factura
          </Link>
        }
      />

      <ErrorBanner message={error} />

      <PendientesImpresion />

      <section className="card">
        <div className="card-pad">
          <div className="toolbar">
            <select
              value={estado}
              onChange={(event) => {
                setEstado(event.target.value)
                setPage(1)
              }}
            >
              <option value="">Todos los estados</option>
              {estados.map((item) => (
                <option key={item} value={item}>
                  {item}
                </option>
              ))}
            </select>
            <input
              placeholder="Número de factura"
              inputMode="numeric"
              value={numero}
              onChange={(event) => {
                setNumero(event.target.value)
                setPage(1)
              }}
            />
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
            <button
              type="button"
              className="button ghost small"
              onClick={() => {
                setEstado('')
                setNumero('')
                setDesde('')
                setHasta('')
                setPage(1)
              }}
            >
              Limpiar
            </button>
          </div>

          {loading ? (
            <LoadingBlock />
          ) : data?.data.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Factura</th>
                      <th>Cliente</th>
                      <th>Cajero</th>
                      <th>Caja</th>
                      <th>Fecha</th>
                      <th>Estado</th>
                      <th className="right">Total</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((factura) => (
                      <tr key={factura.id}>
                        <td>
                          <strong>{factura.numero_completo}</strong>
                        </td>
                        <td>
                          <div className="table-title">
                            <span>{factura.cliente?.razon_social ?? 'Consumidor final'}</span>
                            <small>{factura.cliente?.num_doc ?? 'Sin documento'}</small>
                          </div>
                        </td>
                        <td>{factura.usuario.nombre}</td>
                        <td>{factura.caja?.nombre ?? '—'}</td>
                        <td className="nowrap">{formatDateTime(factura.fecha_emision)}</td>
                        <td>
                          <span className={`badge ${tonoEstado(factura.estado)}`}>
                            {factura.estado}
                          </span>
                        </td>
                        <td className="right">{formatMoney(factura.total)}</td>
                        <td>
                          <div className="table-actions">
                            <Link className="button ghost small" to={`/facturas/${factura.id}`}>
                              Ver
                            </Link>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={data.meta.page}
                totalPages={data.meta.totalPages}
                onChange={setPage}
              />
            </>
          ) : (
            <EmptyState
              title="No hay facturas"
              detail="Ajusta los filtros o crea una nueva factura."
            />
          )}
        </div>
      </section>
    </div>
  )
}
