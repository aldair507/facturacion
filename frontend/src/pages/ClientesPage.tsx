import { useState, type FormEvent } from 'react'
import { useAuth } from '../auth/AuthContext'
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
import { useAction, useResource } from '../lib/hooks'
import type { Cliente, Paged } from '../types'

interface ClienteForm {
  tipo_doc: string
  num_doc: string
  razon_social: string
  email: string
  direccion: string
  telefono: string
  regimen: string
  responsabilidad_fiscal: string
}

const formVacio: ClienteForm = {
  tipo_doc: 'CC',
  num_doc: '',
  razon_social: '',
  email: '',
  direccion: '',
  telefono: '',
  regimen: '',
  responsabilidad_fiscal: '',
}

export function ClientesPage() {
  const { user } = useAuth()
  const esAdmin = user?.rol === 'ADMIN'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'crear' | 'editar' | null>(null)
  const [editando, setEditando] = useState<Cliente | null>(null)
  const [form, setForm] = useState<ClienteForm>(formVacio)
  const accion = useAction()

  const path = `/clientes${toQuery({ page, limit: 15, search })}`
  const { data, loading, error, reload } = useResource<Paged<Cliente>>(path)

  const abrirCrear = () => {
    setEditando(null)
    setForm(formVacio)
    accion.setError(null)
    setModal('crear')
  }

  const abrirEditar = (cliente: Cliente) => {
    setEditando(cliente)
    setForm({
      tipo_doc: cliente.tipo_doc,
      num_doc: cliente.num_doc,
      razon_social: cliente.razon_social,
      email: cliente.email ?? '',
      direccion: cliente.direccion ?? '',
      telefono: cliente.telefono ?? '',
      regimen: cliente.regimen ?? '',
      responsabilidad_fiscal: cliente.responsabilidad_fiscal ?? '',
    })
    accion.setError(null)
    setModal('editar')
  }

  const guardar = async (event: FormEvent) => {
    event.preventDefault()
    const payload = {
      tipo_doc: form.tipo_doc,
      num_doc: form.num_doc,
      razon_social: form.razon_social,
      email: form.email || undefined,
      direccion: form.direccion || undefined,
      telefono: form.telefono || undefined,
      regimen: form.regimen || undefined,
      responsabilidad_fiscal: form.responsabilidad_fiscal || undefined,
    }

    const result = await accion.run(() =>
      editando ? api.patch(`/clientes/${editando.id}`, payload) : api.post('/clientes', payload),
    )

    if (result !== undefined) {
      setModal(null)
      reload()
    }
  }

  const desactivar = async (cliente: Cliente) => {
    if (!window.confirm(`¿Desactivar el cliente ${cliente.razon_social}?`)) return
    const result = await accion.run(() => api.delete(`/clientes/${cliente.id}`))
    if (result !== undefined) reload()
  }

  return (
    <div className="stack">
      <PageHeader
        title="Clientes"
        subtitle="Datos de facturación y contacto de tus clientes."
        actions={
          <button type="button" className="button primary" onClick={abrirCrear}>
            Nuevo cliente
          </button>
        }
      />

      <ErrorBanner message={error ?? accion.error} />

      <section className="card">
        <div className="card-pad">
          <div className="toolbar">
            <input
              className="search"
              placeholder="Buscar por nombre o documento..."
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
            />
          </div>

          {loading ? (
            <LoadingBlock />
          ) : data?.data.length ? (
            <>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Cliente</th>
                      <th>Documento</th>
                      <th>Contacto</th>
                      <th>Estado</th>
                      <th />
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((cliente) => (
                      <tr key={cliente.id}>
                        <td>
                          <div className="table-title">
                            <strong>{cliente.razon_social}</strong>
                            <small>{cliente.regimen ?? 'Sin régimen'}</small>
                          </div>
                        </td>
                        <td>
                          {cliente.tipo_doc} {cliente.num_doc}
                        </td>
                        <td>
                          <div className="table-title">
                            <span>{cliente.email ?? 'Sin correo'}</span>
                            <small>{cliente.telefono ?? 'Sin teléfono'}</small>
                          </div>
                        </td>
                        <td>
                          <Badge tone={cliente.activo ? 'success' : 'danger'}>
                            {cliente.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        <td>
                          <div className="table-actions">
                            <button
                              type="button"
                              className="button ghost small"
                              onClick={() => abrirEditar(cliente)}
                            >
                              Editar
                            </button>
                            {esAdmin && cliente.activo && (
                              <button
                                type="button"
                                className="button ghost small"
                                onClick={() => desactivar(cliente)}
                              >
                                Desactivar
                              </button>
                            )}
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
              title="No hay clientes"
              detail="Registra el primer cliente para facturar."
            />
          )}
        </div>
      </section>

      {modal && (
        <Modal
          title={editando ? 'Editar cliente' : 'Nuevo cliente'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className="button ghost" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                type="submit"
                form="cliente-form"
                className="button primary"
                disabled={accion.pending}
              >
                {accion.pending ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          }
        >
          <form id="cliente-form" className="form-grid" onSubmit={guardar}>
            <Field label="Tipo de documento">
              <select
                value={form.tipo_doc}
                onChange={(event) => setForm({ ...form, tipo_doc: event.target.value })}
              >
                <option value="CC">Cédula de ciudadanía</option>
                <option value="NIT">NIT</option>
                <option value="CE">Cédula de extranjería</option>
                <option value="PP">Pasaporte</option>
                <option value="TI">Tarjeta de identidad</option>
              </select>
            </Field>
            <Field label="Número de documento">
              <input
                required
                maxLength={20}
                value={form.num_doc}
                onChange={(event) => setForm({ ...form, num_doc: event.target.value })}
              />
            </Field>
            <Field label="Razón social" className="full">
              <input
                required
                maxLength={200}
                value={form.razon_social}
                onChange={(event) => setForm({ ...form, razon_social: event.target.value })}
              />
            </Field>
            <FieldRow className="full">
              <Field label="Correo electrónico">
                <input
                  type="email"
                  value={form.email}
                  onChange={(event) => setForm({ ...form, email: event.target.value })}
                />
              </Field>
              <Field label="Teléfono">
                <input
                  value={form.telefono}
                  onChange={(event) => setForm({ ...form, telefono: event.target.value })}
                />
              </Field>
            </FieldRow>
            <Field label="Dirección" className="full">
              <input
                value={form.direccion}
                onChange={(event) => setForm({ ...form, direccion: event.target.value })}
              />
            </Field>
            <Field label="Régimen">
              <input
                value={form.regimen}
                onChange={(event) => setForm({ ...form, regimen: event.target.value })}
              />
            </Field>
            <Field label="Responsabilidad fiscal">
              <input
                value={form.responsabilidad_fiscal}
                onChange={(event) =>
                  setForm({ ...form, responsabilidad_fiscal: event.target.value })
                }
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
