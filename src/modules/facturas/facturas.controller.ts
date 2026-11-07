import type { Request, Response } from 'express'
import { obtenerIp } from '../../lib/auditoria.js'
import { HttpError } from '../../lib/http-error.js'
import { parseId } from '../../lib/parse-id.js'
import {
  agregarPagoSchema,
  anularFacturaSchema,
  crearFacturaSchema,
  listarFacturasQuerySchema,
} from './facturas.schemas.js'
import * as facturasService from './facturas.service.js'

const idempotencyKeyPattern = /^[A-Za-z0-9._:-]{8,80}$/

function obtenerIdempotencyKey(req: Request): string | undefined {
  const header = req.header('idempotency-key')

  if (header === undefined) return undefined

  const key = header.trim()

  if (!idempotencyKeyPattern.test(key)) {
    throw new HttpError(
      400,
      'Idempotency-Key inválida: usa entre 8 y 80 caracteres alfanuméricos, punto, guion o dos puntos',
      'IDEMPOTENCY_KEY_INVALIDA',
    )
  }

  return key
}

export async function listarFacturas(req: Request, res: Response): Promise<void> {
  const query = listarFacturasQuerySchema.parse(req.query)
  const result = await facturasService.listarFacturas(query, req.user!)
  res.json(result)
}

export async function obtenerFactura(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const factura = await facturasService.obtenerFactura(id, req.user!)
  res.json({ data: factura })
}

export async function crearFactura(req: Request, res: Response): Promise<void> {
  const input = crearFacturaSchema.parse(req.body)
  const factura = await facturasService.crearFactura(
    input,
    req.user!,
    obtenerIp(req),
    obtenerIdempotencyKey(req),
  )
  res.status(201).json({ data: factura })
}

export async function agregarPago(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const input = agregarPagoSchema.parse(req.body)
  const factura = await facturasService.agregarPago(
    id,
    input,
    req.user!,
    obtenerIp(req),
    obtenerIdempotencyKey(req),
  )
  res.status(201).json({ data: factura })
}

export async function anularFactura(req: Request, res: Response): Promise<void> {
  const id = parseId(req.params.id)
  const input = anularFacturaSchema.parse(req.body)
  const factura = await facturasService.anularFactura(id, input.motivo, req.user!, obtenerIp(req))
  res.json({ data: factura })
}
