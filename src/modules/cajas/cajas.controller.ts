import type { Request, Response } from 'express'
import { obtenerIp } from '../../lib/auditoria.js'
import { parseId } from '../../lib/parse-id.js'
import { actualizarCajaSchema, crearCajaSchema, listarCajasQuerySchema } from './cajas.schemas.js'
import * as cajasService from './cajas.service.js'

export async function listarCajas(req: Request, res: Response): Promise<void> {
  const query = listarCajasQuerySchema.parse(req.query)
  const result = await cajasService.listarCajas(query)
  res.json(result)
}

export async function obtenerCaja(req: Request, res: Response): Promise<void> {
  const id = Number(parseId(req.params.id))
  const caja = await cajasService.obtenerCaja(id)
  res.json({ data: caja })
}

export async function crearCaja(req: Request, res: Response): Promise<void> {
  const input = crearCajaSchema.parse(req.body)
  const caja = await cajasService.crearCaja(input, req.user!.id, obtenerIp(req))
  res.status(201).json({ data: caja })
}

export async function actualizarCaja(req: Request, res: Response): Promise<void> {
  const id = Number(parseId(req.params.id))
  const input = actualizarCajaSchema.parse(req.body)
  const caja = await cajasService.actualizarCaja(id, input, req.user!.id, obtenerIp(req))
  res.json({ data: caja })
}

export async function desactivarCaja(req: Request, res: Response): Promise<void> {
  const id = Number(parseId(req.params.id))
  const caja = await cajasService.desactivarCaja(id, req.user!.id, obtenerIp(req))
  res.json({ data: caja })
}
