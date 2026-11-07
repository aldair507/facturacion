import { useEffect, useState, type KeyboardEvent } from 'react'
import { EmptyState, ErrorBanner, LoadingBlock } from './Feedback'
import { Modal } from './Modal'
import { toQuery } from '../lib/api'
import { formatMoney, formatNumber, valorNumerico } from '../lib/format'
import { useResource } from '../lib/hooks'
import type { Paged, Producto } from '../types'

export function ProductoBuscador({
  open,
  onClose,
  onSelect,
}: {
  open: boolean
  onClose: () => void
  onSelect: (producto: Producto) => void
}) {
  const [query, setQuery] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const [activo, setActivo] = useState(0)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setBusqueda('')
    setActivo(0)
  }, [open])

  useEffect(() => {
    const timer = window.setTimeout(() => setBusqueda(query.trim()), 250)
    return () => window.clearTimeout(timer)
  }, [query])

  const path = `/productos${toQuery({
    activo: true,
    limit: 20,
    search: busqueda || undefined,
  })}`
  const { data, loading, error } = useResource<Paged<Producto>>(open ? path : null)
  const productos = data?.data ?? []

  useEffect(() => {
    setActivo(0)
  }, [data])

  const seleccionar = (producto: Producto) => {
    if (valorNumerico(producto.stock) <= 0) return
    onSelect(producto)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActivo((actual) => Math.min(actual + 1, Math.max(productos.length - 1, 0)))
      return
    }

    if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActivo((actual) => Math.max(actual - 1, 0))
      return
    }

    if (event.key === 'Enter') {
      event.preventDefault()
      const exacto = productos.find(
        (producto) => producto.codigo.toLowerCase() === query.trim().toLowerCase(),
      )
      const producto = exacto ?? productos[activo]
      if (producto) seleccionar(producto)
    }
  }

  if (!open) return null

  return (
    <Modal
      title="Agregar producto"
      onClose={onClose}
      wide
      footer={
        <>
          <span className="muted small-hint">Enter agrega · ↑↓ navega · Esc cierra</span>
          <span className="spacer" />
          <button type="button" className="button ghost" onClick={onClose}>
            Cerrar
          </button>
        </>
      }
    >
      <div className="stack">
        <label className="field">
          <span>Código o nombre</span>
          <input
            autoFocus
            value={query}
            placeholder="Ej. 7701234567890 o nombre del producto"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={handleKeyDown}
          />
        </label>

        <ErrorBanner message={error} />

        {loading && !data ? (
          <LoadingBlock label="Buscando productos..." />
        ) : productos.length === 0 ? (
          <EmptyState
            title="No hay productos"
            detail="Prueba con otro código o nombre, o revisa el catálogo."
          />
        ) : (
          <div className="producto-resultados" role="listbox" aria-label="Resultados de productos">
            {productos.map((producto, indice) => {
              const sinStock = valorNumerico(producto.stock) <= 0

              return (
                <button
                  type="button"
                  key={producto.id}
                  role="option"
                  aria-selected={indice === activo}
                  disabled={sinStock}
                  className={indice === activo ? 'producto-resultado active' : 'producto-resultado'}
                  onMouseEnter={() => setActivo(indice)}
                  onClick={() => seleccionar(producto)}
                >
                  <div className="producto-resultado-info">
                    <div className="row">
                      <strong>{producto.nombre}</strong>
                      {sinStock && <span className="badge danger">Sin stock</span>}
                    </div>
                    <small>
                      {producto.codigo} · IVA {formatNumber(producto.iva_pct)}%
                    </small>
                  </div>
                  <div className="producto-resultado-precio">
                    <strong>{formatMoney(producto.precio_venta)}</strong>
                    <small>
                      Stock {formatNumber(producto.stock)} {producto.unidad}
                    </small>
                  </div>
                </button>
              )
            })}
          </div>
        )}
      </div>
    </Modal>
  )
}
