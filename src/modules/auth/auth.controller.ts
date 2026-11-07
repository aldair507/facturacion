import type { Request, Response } from 'express'
import { obtenerIp } from '../../lib/auditoria.js'
import { firmarToken } from '../../lib/jwt.js'
import { cambiarPasswordSchema, loginSchema } from './auth.schemas.js'
import { cambiarPassword, login, obtenerUsuarioActual } from './auth.service.js'

export async function loginHandler(req: Request, res: Response): Promise<void> {
  const { email, password } = loginSchema.parse(req.body)
  const user = await login(email, password, obtenerIp(req))

  res.json({
    token: firmarToken(user),
    user,
  })
}

export async function meHandler(req: Request, res: Response): Promise<void> {
  const user = await obtenerUsuarioActual(req.user!.id)
  res.json({ user })
}

export async function cambiarPasswordHandler(req: Request, res: Response): Promise<void> {
  const { password_actual, password_nueva } = cambiarPasswordSchema.parse(req.body)
  await cambiarPassword(req.user!.id, password_actual, password_nueva)
  res.json({ message: 'Contraseña actualizada' })
}
