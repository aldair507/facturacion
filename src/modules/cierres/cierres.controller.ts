import type { Request, Response } from 'express'
import { obtenerIp } from '../../lib/auditoria.js'
import { parseId } from '../../lib/parse-id.js'
import {
  abrirCierreSchema,
  cerrarCierreSchema,
  listarCierresQuerySchema,
} from './cierres.schemas.js'
import * as cierresService from './cierres.service.js'

export async function listarCierres(req: Request, res: Response): Promise<void> {
  const query = listarCierresQuerySchema.parse(req.query)
  const result = await cierresService.listarCierres(query)
  res.json(result)
}

export async function obtenerCierre(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const cierre = await cierresService.obtenerCierre(id)
  res.json({ data: cierre })
}

export async function abrirCierre(req: Request, res: Response): Promise<void> {
  const input = abrirCierreSchema.parse(req.body)
  const cierre = await cierresService.abrirCierre(input, req.user!, obtenerIp(req))
  res.status(201).json({ data: cierre })
}

export async function cerrarCierre(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const input = cerrarCierreSchema.parse(req.body)
  const cierre = await cierresService.cerrarCierre(id, input, req.user!, obtenerIp(req))
  res.json({ data: cierre })
}
