import { Navigate, Route, Routes } from 'react-router-dom'
import type { ReactNode } from 'react'
import { useAuth } from './auth/AuthContext'
import { Layout } from './components/Layout'
import { LoadingBlock } from './components/Feedback'
import { LoginPage } from './pages/LoginPage'
import { DashboardPage } from './pages/DashboardPage'
import { ProductosPage } from './pages/ProductosPage'
import { ClientesPage } from './pages/ClientesPage'
import { CajasPage } from './pages/CajasPage'
import { FacturasPage } from './pages/FacturasPage'
import { FacturaNuevaPage } from './pages/FacturaNuevaPage'
import { FacturaDetallePage } from './pages/FacturaDetallePage'
import { InventarioPage } from './pages/InventarioPage'
import { ReportesPage } from './pages/ReportesPage'

function RequireAuth({ children, admin = false }: { children: ReactNode; admin?: boolean }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="screen-loading">
        <LoadingBlock label="Verificando sesión..." />
      </div>
    )
  }

  if (!user) return <Navigate to="/login" replace />
  if (admin && user.rol !== 'ADMIN') return <Navigate to="/" replace />

  return <>{children}</>
}

export function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="productos" element={<ProductosPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="cajas" element={<CajasPage />} />
        <Route path="facturas" element={<FacturasPage />} />
        <Route path="facturas/nueva" element={<FacturaNuevaPage />} />
        <Route path="facturas/:id" element={<FacturaDetallePage />} />
        <Route
          path="inventario"
          element={
            <RequireAuth admin>
              <InventarioPage />
            </RequireAuth>
          }
        />
        <Route
          path="reportes"
          element={
            <RequireAuth admin>
              <ReportesPage />
            </RequireAuth>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
