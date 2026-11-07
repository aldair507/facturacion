import { useMemo, useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
import {
  Badge,
  EmptyState,
  ErrorBanner,
  LoadingBlock,
  PageHeader,
  Pagination,
} from '../components/Feedback'
import { Field } from '../components/Field'
import { Modal } from '../components/Modal'
import { api, toQuery } from '../lib/api'
import { formatDateTime, formatMoney } from '../lib/format'
import { useAction, useResource } from '../lib/hooks'
import type { Caja, Cierre, Paged } from '../types'

interface CajaForm {
  nombre: string
  activo: boolean
}

const cajaVacia: CajaForm = { nombre: '', activo: true }

export function CajasPage() {
  const { user } = useAuth()
  const esAdmin = user?.rol === 'ADMIN'
  const [page, setPage] = useState(1)
  const [cajaModal, setCajaModal] = useState<'crear' | 'editar' | null>(null)
  const [editando, setEditando] = useState<Caja | null>(null)
  const [cajaForm, setCajaForm] = useState<CajaForm>(cajaVacia)
  const [abriendo, setAbriendo] = useState<Caja | null>(null)
  const [cerrando, setCerrando] = useState<Cierre | null>(null)
  const [baseInicial, setBaseInicial] = useState('0')
  const [observaciones, setObservaciones] = useState('')
  const [efectivoContado, setEfectivoContado] = useState('')
  const accion = useAction()

  const cajasPath = `/cajas${toQuery({ page, limit: 10 })}`
  const cajas = useResource<Paged<Caja>>(cajasPath)
  const abiertos = useResource<Paged<Cierre>>('/cierres?estado=ABIERTO&limit=100')
  const recientes = useResource<Paged<Cierre>>('/cierres?limit=8')

  const abiertosPorId = useMemo(() => {
    const map = new Map<string, Cierre>()
    abiertos.data?.data.forEach((cierre) => map.set(cierre.id, cierre))
    return map
  }, [abiertos.data])

  const recargar = () => {
    cajas.reload()
    abiertos.reload()
    recientes.reload()
  }

  const abrirCrear = () => {
    setEditando(null)
    setCajaForm(cajaVacia)
    accion.setError(null)
    setCajaModal('crear')
  }

  const abrirEditar = (caja: Caja) => {
    setEditando(caja)
    setCajaForm({ nombre: caja.nombre, activo: caja.activo })
    accion.setError(null)
    setCajaModal('editar')
  }

  const guardarCaja = async (event: FormEvent) => {
    event.preventDefault()
    const result = await accion.run(() =>
      editando
        ? api.patch(`/cajas/${editando.id}`, cajaForm)
        : api.post('/cajas', { nombre: cajaForm.nombre }),
    )
    if (result !== undefined) {
      setCajaModal(null)
      recargar()
    }
  }

  const desactivarCaja = async (caja: Caja) => {
    if (!window.confirm(`¿Desactivar la caja ${caja.nombre}?`)) return
    const result = await accion.run(() => api.delete(`/cajas/${caja.id}`))
    if (result !== undefined) recargar()
  }

  const abrirCierre = async (event: FormEvent) => {
    event.preventDefault()
    if (!abriendo) return
    const result = await accion.run(() =>
      api.post('/cierres', {
        caja_id: abriendo.id,
        base_inicial: baseInicial,
        observaciones: observaciones || undefined,
      }),
    )
    if (result !== undefined) {
      setAbriendo(null)
      recargar()
    }
  }

  const cerrarCierre = async (event: FormEvent) => {
    event.preventDefault()
    if (!cerrando) return
    const result = await accion.run(() =>
      api.post(`/cierres/${cerrando.id}/cerrar`, {
        efectivo_contado: efectivoContado || cerrando.efectivo_esperado,
        observaciones: observaciones || undefined,
      }),
    )
    if (result !== undefined) {
      setCerrando(null)
      recargar()
    }
  }

  const puedeCerrar = (cierre: Cierre) => esAdmin || cierre.usuario.id === user?.id

  return (
    <div className="stack">
      <PageHeader
        title="Cajas y cierres"
        subtitle="Apertura, arqueo y cierre de turnos de caja."
        actions={
          esAdmin ? (
            <button type="button" className="button primary" onClick={abrirCrear}>
              Nueva caja
            </button>
          ) : undefined
        }
      />

      <ErrorBanner message={cajas.error ?? abiertos.error ?? recientes.error ?? accion.error} />

      {cajas.loading ? (
        <LoadingBlock />
      ) : cajas.data?.data.length ? (
        <div className="stat-grid">
          {cajas.data.data.map((caja) => {
            const cierre = caja.cierre_abierto
              ? abiertosPorId.get(caja.cierre_abierto.id)
              : undefined

            return (
              <article className="card card-pad stack" key={caja.id}>
                <div className="row">
                  <div>
                    <h2>{caja.nombre}</h2>
                    <small className="muted">Caja #{caja.id}</small>
                  </div>
                  <span className="spacer" />
                  <Badge tone={caja.activo ? 'success' : 'danger'}>
                    {caja.activo ? 'Activa' : 'Inactiva'}
                  </Badge>
                </div>

                {caja.cierre_abierto ? (
                  <div className="summary-box">
                    <div className="summary-line">
                      <span>Turno abierto</span>
                      <strong>{formatDateTime(caja.cierre_abierto.fecha_apertura)}</strong>
                    </div>
                    <div className="summary-line">
                      <span>Base inicial</span>
                      <strong>{formatMoney(caja.cierre_abierto.base_inicial)}</strong>
                    </div>
                    {cierre && (
                      <div className="summary-line">
                        <span>Efectivo esperado</span>
                        <strong>{formatMoney(cierre.efectivo_esperado)}</strong>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="alert info">La caja no tiene un cierre abierto.</div>
                )}

                <div className="row">
                  {caja.activo && !caja.cierre_abierto && (
                    <button
                      type="button"
                      className="button primary small"
                      onClick={() => {
                        setAbriendo(caja)
                        setBaseInicial('0')
                        setObservaciones('')
                        accion.setError(null)
                      }}
                    >
                      Abrir cierre
                    </button>
                  )}
                  {caja.cierre_abierto && cierre && puedeCerrar(cierre) && (
                    <button
                      type="button"
                      className="button primary small"
                      onClick={() => {
                        setCerrando(cierre)
                        setEfectivoContado(cierre.efectivo_esperado)
                        setObservaciones('')
                        accion.setError(null)
                      }}
                    >
                      Cerrar cierre
                    </button>
                  )}
                  {esAdmin && (
                    <>
                      <button
                        type="button"
                        className="button ghost small"
                        onClick={() => abrirEditar(caja)}
                      >
                        Editar
                      </button>
                      {caja.activo && !caja.cierre_abierto && (
                        <button
                          type="button"
                          className="button ghost small"
                          onClick={() => desactivarCaja(caja)}
                        >
                          Desactivar
                        </button>
                      )}
                    </>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      ) : (
        <EmptyState title="No hay cajas" detail="Crea una caja para iniciar la operación." />
      )}

      {cajas.data && (
        <Pagination
          page={cajas.data.meta.page}
          totalPages={cajas.data.meta.totalPages}
          onChange={setPage}
        />
      )}

      <section className="card">
        <header className="card-header">
          <div>
            <h2>Cierres recientes</h2>
            <p>Últimos turnos registrados</p>
          </div>
        </header>
        {recientes.loading ? (
          <LoadingBlock />
        ) : recientes.data?.data.length ? (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Caja</th>
                  <th>Responsable</th>
                  <th>Apertura</th>
                  <th>Cierre</th>
                  <th>Estado</th>
                  <th className="right">Efectivo contado</th>
                  <th className="right">Diferencia</th>
                </tr>
              </thead>
              <tbody>
                {recientes.data.data.map((cierre) => (
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
                    <td className="right">
                      {cierre.efectivo_contado ? formatMoney(cierre.efectivo_contado) : '—'}
                    </td>
                    <td className="right">{formatMoney(cierre.diferencia)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <EmptyState title="Sin cierres registrados" />
        )}
      </section>

      {cajaModal && (
        <Modal
          title={editando ? 'Editar caja' : 'Nueva caja'}
          onClose={() => setCajaModal(null)}
          footer={
            <>
              <button type="button" className="button ghost" onClick={() => setCajaModal(null)}>
                Cancelar
              </button>
              <button
                type="submit"
                form="caja-form"
                className="button primary"
                disabled={accion.pending}
              >
                {accion.pending ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          }
        >
          <form id="caja-form" className="stack" onSubmit={guardarCaja}>
            <Field label="Nombre de la caja">
              <input
                required
                maxLength={50}
                value={cajaForm.nombre}
                onChange={(event) => setCajaForm({ ...cajaForm, nombre: event.target.value })}
              />
            </Field>
            {editando && (
              <label className="row">
                <input
                  type="checkbox"
                  style={{ width: 'auto', minHeight: 'auto' }}
                  checked={cajaForm.activo}
                  onChange={(event) => setCajaForm({ ...cajaForm, activo: event.target.checked })}
                />
                <span>Caja activa</span>
              </label>
            )}
            <ErrorBanner message={accion.error} />
          </form>
        </Modal>
      )}

      {abriendo && (
        <Modal
          title={`Abrir cierre · ${abriendo.nombre}`}
          onClose={() => setAbriendo(null)}
          footer={
            <>
              <button type="button" className="button ghost" onClick={() => setAbriendo(null)}>
                Cancelar
              </button>
              <button
                type="submit"
                form="abrir-form"
                className="button primary"
                disabled={accion.pending}
              >
                {accion.pending ? 'Abriendo...' : 'Abrir cierre'}
              </button>
            </>
          }
        >
          <form id="abrir-form" className="stack" onSubmit={abrirCierre}>
            <Field label="Base inicial" hint="Efectivo con el que inicia el turno.">
              <input
                required
                inputMode="decimal"
                value={baseInicial}
                onChange={(event) => setBaseInicial(event.target.value)}
              />
            </Field>
            <Field label="Observaciones">
              <textarea
                maxLength={2000}
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
              />
            </Field>
            <ErrorBanner message={accion.error} />
          </form>
        </Modal>
      )}

      {cerrando && (
        <Modal
          title={`Cerrar cierre · ${cerrando.caja.nombre}`}
          onClose={() => setCerrando(null)}
          footer={
            <>
              <button type="button" className="button ghost" onClick={() => setCerrando(null)}>
                Cancelar
              </button>
              <button
                type="submit"
                form="cerrar-form"
                className="button primary"
                disabled={accion.pending}
              >
                {accion.pending ? 'Cerrando...' : 'Cerrar cierre'}
              </button>
            </>
          }
        >
          <form id="cerrar-form" className="stack" onSubmit={cerrarCierre}>
            <div className="cierre-total-card">
              <span>Total vendido en el turno</span>
              <strong>{formatMoney(cerrando.total_ventas)}</strong>
              <small>{cerrando.cantidad_facturas} factura(s) registradas</small>
            </div>
            <p className="muted small-hint">
              El arqueo de efectivo se registra automáticamente con el valor esperado del turno.
            </p>
            <Field label="Observaciones">
              <textarea
                maxLength={2000}
                value={observaciones}
                onChange={(event) => setObservaciones(event.target.value)}
              />
            </Field>
            <ErrorBanner message={accion.error} />
          </form>
        </Modal>
      )}
    </div>
  )
}
