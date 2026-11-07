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
import { formatMoney, formatNumber } from '../lib/format'
import { useAction, useResource } from '../lib/hooks'
import type { Paged, Producto } from '../types'

interface ProductoForm {
  codigo: string
  nombre: string
  descripcion: string
  precio_venta: string
  costo: string
  iva_pct: string
  unidad: string
  stock_minimo: string
  stock_inicial: string
}

const formVacio: ProductoForm = {
  codigo: '',
  nombre: '',
  descripcion: '',
  precio_venta: '',
  costo: '0',
  iva_pct: '19',
  unidad: 'UND',
  stock_minimo: '0',
  stock_inicial: '0',
}

export function ProductosPage() {
  const { user } = useAuth()
  const esAdmin = user?.rol === 'ADMIN'
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [modal, setModal] = useState<'crear' | 'editar' | null>(null)
  const [editando, setEditando] = useState<Producto | null>(null)
  const [form, setForm] = useState<ProductoForm>(formVacio)
  const accion = useAction()

  const path = `/productos${toQuery({ page, limit: 15, search })}`
  const { data, loading, error, reload } = useResource<Paged<Producto>>(path)

  const abrirCrear = () => {
    setEditando(null)
    setForm(formVacio)
    accion.setError(null)
    setModal('crear')
  }

  const abrirEditar = (producto: Producto) => {
    setEditando(producto)
    setForm({
      codigo: producto.codigo,
      nombre: producto.nombre,
      descripcion: producto.descripcion ?? '',
      precio_venta: producto.precio_venta,
      costo: producto.costo,
      iva_pct: producto.iva_pct,
      unidad: producto.unidad,
      stock_minimo: producto.stock_minimo,
      stock_inicial: '0',
    })
    accion.setError(null)
    setModal('editar')
  }

  const guardar = async (event: FormEvent) => {
    event.preventDefault()
    const payload = {
      codigo: form.codigo,
      nombre: form.nombre,
      descripcion: form.descripcion || undefined,
      precio_venta: form.precio_venta,
      costo: form.costo,
      iva_pct: form.iva_pct,
      unidad: form.unidad,
      stock_minimo: form.stock_minimo,
      ...(editando ? {} : { stock_inicial: form.stock_inicial }),
    }

    const result = await accion.run(() =>
      editando ? api.patch(`/productos/${editando.id}`, payload) : api.post('/productos', payload),
    )

    if (result !== undefined) {
      setModal(null)
      reload()
    }
  }

  const desactivar = async (producto: Producto) => {
    if (!window.confirm(`¿Desactivar el producto ${producto.nombre}?`)) return
    const result = await accion.run(() => api.delete(`/productos/${producto.id}`))
    if (result !== undefined) reload()
  }

  return (
    <div className="stack">
      <PageHeader
        title="Productos"
        subtitle="Catálogo de productos, precios, impuestos y existencias."
        actions={
          esAdmin ? (
            <button type="button" className="button primary" onClick={abrirCrear}>
              Nuevo producto
            </button>
          ) : undefined
        }
      />

      <ErrorBanner message={error ?? accion.error} />

      <section className="card">
        <div className="card-pad">
          <div className="toolbar">
            <input
              className="search"
              placeholder="Buscar por código o nombre..."
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
                      <th>Producto</th>
                      <th className="right">Precio venta</th>
                      <th className="right">Costo</th>
                      <th className="right">IVA</th>
                      <th className="right">Stock</th>
                      <th>Estado</th>
                      {esAdmin && <th />}
                    </tr>
                  </thead>
                  <tbody>
                    {data.data.map((producto) => (
                      <tr key={producto.id}>
                        <td>
                          <div className="table-title">
                            <strong>{producto.nombre}</strong>
                            <small>
                              {producto.codigo} · {producto.unidad}
                            </small>
                          </div>
                        </td>
                        <td className="right">{formatMoney(producto.precio_venta)}</td>
                        <td className="right">{formatMoney(producto.costo)}</td>
                        <td className="right">{formatNumber(producto.iva_pct)}%</td>
                        <td className="right">
                          <Badge
                            tone={
                              Number(producto.stock) <= Number(producto.stock_minimo)
                                ? 'warning'
                                : 'neutral'
                            }
                          >
                            {formatNumber(producto.stock)}
                          </Badge>
                          <small className="muted">
                            {' '}
                            / mín. {formatNumber(producto.stock_minimo)}
                          </small>
                        </td>
                        <td>
                          <Badge tone={producto.activo ? 'success' : 'danger'}>
                            {producto.activo ? 'Activo' : 'Inactivo'}
                          </Badge>
                        </td>
                        {esAdmin && (
                          <td>
                            <div className="table-actions">
                              <button
                                type="button"
                                className="button ghost small"
                                onClick={() => abrirEditar(producto)}
                              >
                                Editar
                              </button>
                              {producto.activo && (
                                <button
                                  type="button"
                                  className="button ghost small"
                                  onClick={() => desactivar(producto)}
                                >
                                  Desactivar
                                </button>
                              )}
                            </div>
                          </td>
                        )}
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
            <EmptyState title="No hay productos" detail="Crea el primer producto del catálogo." />
          )}
        </div>
      </section>

      {modal && (
        <Modal
          title={editando ? 'Editar producto' : 'Nuevo producto'}
          onClose={() => setModal(null)}
          footer={
            <>
              <button type="button" className="button ghost" onClick={() => setModal(null)}>
                Cancelar
              </button>
              <button
                type="submit"
                form="producto-form"
                className="button primary"
                disabled={accion.pending}
              >
                {accion.pending ? 'Guardando...' : 'Guardar'}
              </button>
            </>
          }
        >
          <form id="producto-form" className="form-grid" onSubmit={guardar}>
            <Field label="Código">
              <input
                required
                maxLength={40}
                value={form.codigo}
                onChange={(event) => setForm({ ...form, codigo: event.target.value })}
              />
            </Field>
            <Field label="Nombre">
              <input
                required
                maxLength={200}
                value={form.nombre}
                onChange={(event) => setForm({ ...form, nombre: event.target.value })}
              />
            </Field>
            <Field label="Descripción" className="full">
              <textarea
                value={form.descripcion}
                onChange={(event) => setForm({ ...form, descripcion: event.target.value })}
              />
            </Field>
            <FieldRow>
              <Field label="Precio de venta">
                <input
                  required
                  inputMode="decimal"
                  value={form.precio_venta}
                  onChange={(event) => setForm({ ...form, precio_venta: event.target.value })}
                />
              </Field>
              <Field label="Costo">
                <input
                  required
                  inputMode="decimal"
                  value={form.costo}
                  onChange={(event) => setForm({ ...form, costo: event.target.value })}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="IVA (%)">
                <input
                  required
                  inputMode="decimal"
                  value={form.iva_pct}
                  onChange={(event) => setForm({ ...form, iva_pct: event.target.value })}
                />
              </Field>
              <Field label="Unidad">
                <input
                  required
                  maxLength={20}
                  value={form.unidad}
                  onChange={(event) => setForm({ ...form, unidad: event.target.value })}
                />
              </Field>
            </FieldRow>
            <FieldRow>
              <Field label="Stock mínimo">
                <input
                  required
                  inputMode="decimal"
                  value={form.stock_minimo}
                  onChange={(event) => setForm({ ...form, stock_minimo: event.target.value })}
                />
              </Field>
              {!editando && (
                <Field label="Stock inicial">
                  <input
                    required
                    inputMode="decimal"
                    value={form.stock_inicial}
                    onChange={(event) => setForm({ ...form, stock_inicial: event.target.value })}
                  />
                </Field>
              )}
            </FieldRow>
            <div className="full">
              <ErrorBanner message={accion.error} />
            </div>
          </form>
        </Modal>
      )}
    </div>
  )
}
