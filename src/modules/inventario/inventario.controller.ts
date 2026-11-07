import type { Request, Response } from 'express'
import { obtenerIp } from '../../lib/auditoria.js'
import { parseId } from '../../lib/parse-id.js'
import {
  crearMovimientoInventarioSchema,
  kardexQuerySchema,
  listarMovimientosQuerySchema,
  listarStockBajoQuerySchema,
} from './inventario.schemas.js'
import * as inventarioService from './inventario.service.js'

export async function listarMovimientos(req: Request, res: Response): Promise<void> {
  const query = listarMovimientosQuerySchema.parse(req.query)
  const result = await inventarioService.listarMovimientos(query)
  res.json(result)
}

export async function crearMovimiento(req: Request, res: Response): Promise<void> {
  const input = crearMovimientoInventarioSchema.parse(req.body)
  const movimiento = await inventarioService.crearMovimiento(input, req.user!.id, obtenerIp(req))
  res.status(201).json({ data: movimiento })
}

export async function listarStockBajo(req: Request, res: Response): Promise<void> {
  const query = listarStockBajoQuerySchema.parse(req.query)
  const result = await inventarioService.listarStockBajo(query)
  res.json(result)
}

export async function obtenerValorizacion(_req: Request, res: Response): Promise<void> {
  const valorizacion = await inventarioService.obtenerValorizacion()
  res.json({ data: valorizacion })
}

export async function obtenerKardex(req: Request, res: Response): Promise<void> {
  const productoId = parseId(req.params.id)
  const query = kardexQuerySchema.parse(req.query)
  const result = await inventarioService.obtenerKardex(productoId, query)
  res.json(result)
}
