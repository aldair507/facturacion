import type { Request, Response } from 'express'
import { obtenerIp } from '../../lib/auditoria.js'
import { parseId } from '../../lib/parse-id.js'
import {
  actualizarUsuarioSchema,
  crearUsuarioSchema,
  listarUsuariosQuerySchema,
  restablecerPasswordSchema,
} from './usuarios.schemas.js'
import * as usuariosService from './usuarios.service.js'

export async function listarUsuarios(req: Request, res: Response): Promise<void> {
  const query = listarUsuariosQuerySchema.parse(req.query)
  const result = await usuariosService.listarUsuarios(query)
  res.json(result)
}

export async function obtenerUsuario(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const usuario = await usuariosService.obtenerUsuario(id)
  res.json({ data: usuario })
}

export async function crearUsuario(req: Request, res: Response): Promise<void> {
  const input = crearUsuarioSchema.parse(req.body)
  const usuario = await usuariosService.crearUsuario(input, req.user!.id, obtenerIp(req))
  res.status(201).json({ data: usuario })
}

export async function actualizarUsuario(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const input = actualizarUsuarioSchema.parse(req.body)
  const usuario = await usuariosService.actualizarUsuario(id, input, req.user!.id, obtenerIp(req))
  res.json({ data: usuario })
}

export async function restablecerPassword(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const { password } = restablecerPasswordSchema.parse(req.body)
  await usuariosService.restablecerPassword(id, password, req.user!.id, obtenerIp(req))
  res.json({ message: 'Contraseña actualizada' })
}

export async function desactivarUsuario(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const usuario = await usuariosService.desactivarUsuario(id, req.user!.id, obtenerIp(req))
  res.json({ data: usuario })
}
