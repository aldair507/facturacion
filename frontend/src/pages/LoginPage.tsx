import { useState, type FormEvent } from 'react'
import { Navigate, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { ErrorBanner } from '../components/Feedback'
import { Field } from '../components/Field'
import { useAction } from '../lib/hooks'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const { pending, error, run } = useAction()

  if (user) return <Navigate to="/" replace />

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    const result = await run(() => login(email, password))
    if (result !== undefined) navigate('/', { replace: true })
  }

  return (
    <div className="login-shell">
      <aside className="login-visual">
        <div className="login-brand">
          <span className="brand-mark large">F</span>
          <span>Facturación</span>
        </div>
        <div>
          <h1>Controla tus ventas, caja e inventario en un solo lugar.</h1>
          <p>
            Factura de forma transaccional, registra pagos y consulta los reportes operativos de tu
            negocio.
          </p>
        </div>
        <ul className="login-points">
          <li>Facturación con pagos parciales</li>
          <li>Arqueo y cierre de caja</li>
          <li>Inventario y reportes exportables</li>
        </ul>
      </aside>

      <main className="login-panel">
        <form className="login-card" onSubmit={handleSubmit}>
          <div>
            <h2>Iniciar sesión</h2>
            <p className="muted">Ingresa con tus credenciales de operador.</p>
          </div>
          <ErrorBanner message={error} />
          <Field label="Correo electrónico">
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="usuario@empresa.com"
            />
          </Field>
          <Field label="Contraseña">
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              placeholder="Tu contraseña"
            />
          </Field>
          <button className="button primary block" type="submit" disabled={pending}>
            {pending ? 'Ingresando...' : 'Ingresar'}
          </button>
          <div className="demo-box">
            <strong>Usuarios de demostración</strong>
            <span>admin@demo.com / Admin123*</span>
            <span>cajero@demo.com / Cajero123*</span>
          </div>
        </form>
      </main>
    </div>
  )
}
