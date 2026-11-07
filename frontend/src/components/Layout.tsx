import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '../auth/AuthContext'

const navItems = [
  { to: '/', label: 'Panel', end: true },
  { to: '/facturas', label: 'Facturación' },
  { to: '/productos', label: 'Productos' },
  { to: '/clientes', label: 'Clientes' },
  { to: '/cajas', label: 'Cajas y cierres' },
  { to: '/inventario', label: 'Inventario', soloAdmin: true },
  { to: '/reportes', label: 'Reportes', soloAdmin: true },
]

export function Layout() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()
  const [menuAbierto, setMenuAbierto] = useState(false)

  const cerrarSesion = () => {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <button
          type="button"
          className="icon-button menu-toggle"
          aria-label="Abrir menú"
          onClick={() => setMenuAbierto((abierto) => !abierto)}
        >
          <span />
          <span />
          <span />
        </button>
        <div className="brand">
          <span className="brand-mark">F</span>
          <div>
            <strong>Facturación</strong>
            <small>Gestión comercial</small>
          </div>
        </div>
        <div className="topbar-user">
          <div>
            <strong>{user?.nombre}</strong>
            <small>{user?.rol === 'ADMIN' ? 'Administrador' : 'Cajero'}</small>
          </div>
          <button type="button" className="button ghost small" onClick={cerrarSesion}>
            Salir
          </button>
        </div>
      </header>

      <div className="app-body">
        <nav className={menuAbierto ? 'sidebar open' : 'sidebar'}>
          <div className="sidebar-section">
            <span className="sidebar-label">Operación</span>
            {navItems
              .filter((item) => !item.soloAdmin || user?.rol === 'ADMIN')
              .map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.end}
                  className={({ isActive }) => (isActive ? 'nav-link active' : 'nav-link')}
                  onClick={() => setMenuAbierto(false)}
                >
                  {item.label}
                </NavLink>
              ))}
          </div>
          <div className="sidebar-footer">
            <div className="user-card">
              <span className="avatar">{user?.nombre.slice(0, 1).toUpperCase()}</span>
              <div>
                <strong>{user?.nombre}</strong>
                <small>{user?.email}</small>
              </div>
            </div>
          </div>
        </nav>

        {menuAbierto && (
          <button
            type="button"
            className="sidebar-backdrop"
            aria-label="Cerrar menú"
            onClick={() => setMenuAbierto(false)}
          />
        )}

        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
