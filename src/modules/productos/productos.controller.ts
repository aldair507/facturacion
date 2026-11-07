import type { Request, Response } from 'express'
import { parseId } from '../../lib/parse-id.js'
import {
  actualizarProductoSchema,
  crearProductoSchema,
  listarProductosQuerySchema,
} from './productos.schemas.js'
import * as productosService from './productos.service.js'

export async function listarProductos(req: Request, res: Response): Promise<void> {
  const query = listarProductosQuerySchema.parse(req.query)
  const result = await productosService.listarProductos(query)
  res.json(result)
}

export async function obtenerProducto(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const producto = await productosService.obtenerProducto(id)
  res.json({ data: producto })
}

export async function crearProducto(req: Request, res: Response): Promise<void> {
  const input = crearProductoSchema.parse(req.body)
  const producto = await productosService.crearProducto(input, req.user!.id)
  res.status(201).json({ data: producto })
}

export async function actualizarProducto(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const input = actualizarProductoSchema.parse(req.body)
  const producto = await productosService.actualizarProducto(id, input)
  res.json({ data: producto })
}

export async function eliminarProducto(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const producto = await productosService.eliminarProducto(id)
  res.json({ data: producto })
}
