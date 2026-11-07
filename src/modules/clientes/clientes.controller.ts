import type { Request, Response } from 'express'
import { parseId } from '../../lib/parse-id.js'
import {
  actualizarClienteSchema,
  crearClienteSchema,
  listarClientesQuerySchema,
} from './clientes.schemas.js'
import * as clientesService from './clientes.service.js'

export async function listarClientes(req: Request, res: Response): Promise<void> {
  const query = listarClientesQuerySchema.parse(req.query)
  const result = await clientesService.listarClientes(query)
  res.json(result)
}

export async function obtenerCliente(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const cliente = await clientesService.obtenerCliente(id)
  res.json({ data: cliente })
}

export async function crearCliente(req: Request, res: Response): Promise<void> {
  const input = crearClienteSchema.parse(req.body)
  const cliente = await clientesService.crearCliente(input)
  res.status(201).json({ data: cliente })
}

export async function actualizarCliente(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const input = actualizarClienteSchema.parse(req.body)
  const cliente = await clientesService.actualizarCliente(id, input)
  res.json({ data: cliente })
}

export async function eliminarCliente(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const cliente = await clientesService.eliminarCliente(id)
  res.json({ data: cliente })
}
