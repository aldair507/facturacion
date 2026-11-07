import { env } from '../../config/env.js'
import { prisma } from '../../db/prisma.js'
import { Prisma, type productos } from '../../generated/prisma/client.js'
import { registrarAuditoria } from '../../lib/auditoria.js'
import { HttpError } from '../../lib/http-error.js'
import { aDecimal, redondear, sumar } from '../../lib/money.js'
import { calcularSkip, crearMeta, type MetaPaginacion } from '../../lib/pagination.js'
import { esDuplicado, esViolacionCheck } from '../../lib/prisma-errors.js'
import type { AuthUser } from '../auth/auth.types.js'
import {
  toFacturaDetalleDTO,
  toFacturaResumenDTO,
  type FacturaDetalleDTO,
  type FacturaResumenDTO,
} from './facturas.mapper.js'
import type {
  AgregarPagoInput,
  CrearFacturaInput,
  ListarFacturasQuery,
} from './facturas.schemas.js'
import { facturaDetalleSelect, facturaResumenSelect } from './facturas.selects.js'

export interface ListarFacturasResult {
  data: FacturaResumenDTO[]
  meta: MetaPaginacion
}

function validarAcceso(usuarioFacturaId: bigint, usuario: AuthUser): void {
  if (usuario.rol === 'CAJERO' && usuarioFacturaId.toString() !== usuario.id) {
    throw new HttpError(403, 'No tienes acceso a esta factura', 'FORBIDDEN')
  }
}

async function buscarFacturaIdempotente(
  usuarioId: string,
  idempotencyKey: string,
): Promise<FacturaDetalleDTO | null> {
  const factura = await prisma.facturas.findFirst({
    where: {
      usuario_id: BigInt(usuarioId),
      idempotency_key: idempotencyKey,
    },
    select: facturaDetalleSelect,
  })

  return factura ? toFacturaDetalleDTO(factura) : null
}

async function buscarFacturaPorId(
  id: bigint,
  usuario: AuthUser,
): Promise<FacturaDetalleDTO | null> {
  const factura = await prisma.facturas.findUnique({
    where: { id },
    select: facturaDetalleSelect,
  })

  if (!factura) return null

  validarAcceso(factura.usuario_id, usuario)

  return toFacturaDetalleDTO(factura)
}

export async function listarFacturas(
  params: ListarFacturasQuery,
  usuario: AuthUser,
): Promise<ListarFacturasResult> {
  const where: Prisma.facturasWhereInput = {}

  if (params.estado) {
    where.estado = params.estado
  }
  if (params.cliente_id) {
    where.cliente_id = BigInt(params.cliente_id)
  }
  if (params.caja_id !== undefined) {
    where.caja_id = params.caja_id
  }
  if (params.numero !== undefined) {
    where.numero = params.numero
  }
  if (usuario.rol === 'CAJERO') {
    where.usuario_id = BigInt(usuario.id)
  }

  const fecha: { gte?: Date; lt?: Date } = {}
  if (params.desde) {
    fecha.gte = params.desde
  }
  if (params.hasta) {
    fecha.lt = new Date(params.hasta.getTime() + 24 * 60 * 60 * 1000)
  }
  if (Object.keys(fecha).length > 0) {
    where.fecha_emision = fecha
  }

  const [total, facturas] = await prisma.$transaction([
    prisma.facturas.count({ where }),
    prisma.facturas.findMany({
      where,
      select: facturaResumenSelect,
      orderBy: { id: 'desc' },
      skip: calcularSkip(params),
      take: params.limit,
    }),
  ])

  return {
    data: facturas.map(toFacturaResumenDTO),
    meta: crearMeta(params, total),
  }
}

export async function obtenerFactura(id: bigint, usuario: AuthUser): Promise<FacturaDetalleDTO> {
  const factura = await prisma.facturas.findUnique({
    where: { id },
    select: facturaDetalleSelect,
  })

  if (!factura) {
    throw new HttpError(404, 'Factura no encontrada', 'NOT_FOUND')
  }

  validarAcceso(factura.usuario_id, usuario)

  return toFacturaDetalleDTO(factura)
}

export async function crearFactura(
  input: CrearFacturaInput,
  usuario: AuthUser,
  ip: string | null = null,
  idempotencyKey?: string,
): Promise<FacturaDetalleDTO> {
  if (idempotencyKey) {
    const existente = await buscarFacturaIdempotente(usuario.id, idempotencyKey)

    if (existente) return existente
  }

  try {
    return await prisma.$transaction(
      async (tx) => {
        const resoluciones = await tx.$queryRaw<Array<{ id: number }>>`
          SELECT id
          FROM resoluciones
          WHERE activo = true
            AND vigencia_desde <= CURRENT_DATE
            AND vigencia_hasta >= CURRENT_DATE
          ORDER BY id
          LIMIT 1
          FOR UPDATE
        `

        const resolucionId = resoluciones[0]?.id

        if (resolucionId === undefined) {
          throw new HttpError(
            409,
            'No hay una resolución de facturación activa y vigente',
            'SIN_RESOLUCION',
          )
        }

        const resolucion = await tx.resoluciones.findUniqueOrThrow({
          where: { id: resolucionId },
        })

        if (resolucion.siguiente > resolucion.rango_hasta) {
          throw new HttpError(
            409,
            'La resolución de facturación está agotada',
            'RESOLUCION_AGOTADA',
          )
        }

        const numero = resolucion.siguiente

        await tx.resoluciones.update({
          where: { id: resolucion.id },
          data: { siguiente: { increment: 1 } },
        })

        let clienteId: bigint | null = null
        if (input.cliente_id) {
          const cliente = await tx.clientes.findUnique({
            where: { id: BigInt(input.cliente_id) },
          })

          if (!cliente || !cliente.activo) {
            throw new HttpError(409, 'El cliente no existe o está inactivo', 'CLIENTE_INVALIDO')
          }

          clienteId = cliente.id
        }

        let cajaId: number | null = null
        let cierreId: bigint | null = null
        if (input.caja_id !== undefined) {
          const cajaBloqueada = await tx.$queryRaw<Array<{ id: number }>>`
            SELECT id FROM cajas WHERE id = ${input.caja_id} FOR SHARE
          `

          if (cajaBloqueada.length === 0) {
            throw new HttpError(409, 'La caja no existe', 'CAJA_INVALIDA')
          }

          const caja = await tx.cajas.findUniqueOrThrow({ where: { id: input.caja_id } })

          if (!caja || !caja.activo) {
            throw new HttpError(409, 'La caja no existe o está inactiva', 'CAJA_INVALIDA')
          }

          const cierre = await tx.cierres_caja.findFirst({
            where: { caja_id: caja.id, estado: 'ABIERTO' },
            select: { id: true, usuario_id: true },
          })

          if (!cierre) {
            throw new HttpError(
              409,
              'La caja no tiene un cierre abierto',
              'CAJA_SIN_CIERRE_ABIERTO',
            )
          }

          if (usuario.rol === 'CAJERO' && cierre.usuario_id.toString() !== usuario.id) {
            throw new HttpError(
              403,
              'No puedes facturar con el cierre abierto de otro usuario',
              'CIERRE_NO_PROPIO',
            )
          }

          cajaId = caja.id
          cierreId = cierre.id
        }

        const itemsOrdenados = [...input.items].sort((a, b) => {
          const idA = BigInt(a.producto_id)
          const idB = BigInt(b.producto_id)
          return idA < idB ? -1 : idA > idB ? 1 : 0
        })

        const idsProductos = itemsOrdenados.map((item) => BigInt(item.producto_id))

        const bloqueados = await tx.$queryRaw<Array<{ id: bigint }>>`
          SELECT id
          FROM productos
          WHERE id IN (${Prisma.join(idsProductos)})
          ORDER BY id
          FOR UPDATE
        `

        if (bloqueados.length !== idsProductos.length) {
          const encontrados = new Set(bloqueados.map((producto) => producto.id.toString()))
          const faltante = idsProductos.find((id) => !encontrados.has(id.toString()))
          throw new HttpError(
            404,
            `Producto ${faltante?.toString() ?? 'desconocido'} no encontrado`,
            'PRODUCTO_NO_ENCONTRADO',
          )
        }

        const productosEncontrados = await tx.productos.findMany({
          where: { id: { in: idsProductos } },
        })
        const productosPorId = new Map<string, productos>()

        for (const item of itemsOrdenados) {
          const producto = productosEncontrados.find(
            (candidato) => candidato.id === BigInt(item.producto_id),
          )

          if (!producto) {
            throw new HttpError(
              404,
              `Producto ${item.producto_id} no encontrado`,
              'PRODUCTO_NO_ENCONTRADO',
            )
          }

          if (!producto.activo) {
            throw new HttpError(
              409,
              `El producto ${producto.codigo} está inactivo`,
              'PRODUCTO_INACTIVO',
            )
          }

          const cantidad = aDecimal(item.cantidad)

          if (producto.stock.lt(cantidad)) {
            throw new HttpError(
              409,
              `Stock insuficiente para el producto ${producto.codigo}`,
              'STOCK_INSUFICIENTE',
            )
          }

          productosPorId.set(item.producto_id, producto)
        }

        const lineas = input.items.map((item) => {
          const producto = productosPorId.get(item.producto_id)

          if (!producto) {
            throw new HttpError(
              500,
              'No se pudo cargar el producto de la factura',
              'PRODUCTO_NO_DISPONIBLE',
            )
          }

          const cantidad = aDecimal(item.cantidad)
          const precio = aDecimal(producto.precio_venta)
          const descuento = redondear(aDecimal(item.descuento))
          const bruto = cantidad.mul(precio)

          if (descuento.gt(bruto)) {
            throw new HttpError(
              422,
              `El descuento supera el valor de la línea ${producto.codigo}`,
              'DESCUENTO_INVALIDO',
            )
          }

          const subtotal = redondear(bruto.minus(descuento))
          const iva = redondear(subtotal.mul(aDecimal(producto.iva_pct)).div(100))
          const total = redondear(subtotal.plus(iva))

          return {
            producto,
            cantidad,
            precio,
            descuento,
            subtotal,
            iva,
            total,
          }
        })

        const brutoFactura = redondear(
          sumar(lineas.map((linea) => redondear(linea.cantidad.mul(linea.precio)))),
        )
        const subtotalFactura = redondear(sumar(lineas.map((linea) => linea.subtotal)))
        const descuentoFactura = redondear(sumar(lineas.map((linea) => linea.descuento)))
        const ivaFactura = redondear(sumar(lineas.map((linea) => linea.iva)))
        const totalFactura = redondear(sumar(lineas.map((linea) => linea.total)))

        if (usuario.rol === 'CAJERO' && brutoFactura.gt(0)) {
          const porcentajeDescuento = descuentoFactura.div(brutoFactura).mul(100)

          if (porcentajeDescuento.gt(env.MAX_DESCUENTO_CAJERO)) {
            throw new HttpError(
              403,
              `El descuento supera el máximo permitido para cajeros (${env.MAX_DESCUENTO_CAJERO}%)`,
              'DESCUENTO_NO_PERMITIDO',
            )
          }
        }

        const totalPagos = redondear(sumar(input.pagos.map((pago) => aDecimal(pago.monto))))

        if (totalPagos.gt(totalFactura)) {
          throw new HttpError(409, 'Los pagos superan el total de la factura', 'PAGO_EXCEDE_TOTAL')
        }

        const estado = totalPagos.eq(totalFactura) ? 'PAGADA' : 'EMITIDA'
        const factura = await tx.facturas.create({
          data: {
            prefijo: resolucion.prefijo,
            numero,
            cliente_id: clienteId,
            usuario_id: BigInt(usuario.id),
            caja_id: cajaId,
            cierre_id: cierreId,
            idempotency_key: idempotencyKey,
            subtotal: subtotalFactura,
            descuento: descuentoFactura,
            iva_total: ivaFactura,
            total: totalFactura,
            estado,
          },
        })

        const referencia = `${resolucion.prefijo}-${numero}`

        await tx.detalle_factura.createMany({
          data: lineas.map((linea) => ({
            factura_id: factura.id,
            producto_id: linea.producto.id,
            codigo: linea.producto.codigo,
            descripcion: linea.producto.nombre,
            cantidad: linea.cantidad,
            precio_unitario: linea.precio,
            descuento: linea.descuento,
            iva_pct: linea.producto.iva_pct,
            subtotal: linea.subtotal,
            iva: linea.iva,
            total: linea.total,
          })),
        })

        await tx.inventario_movimientos.createMany({
          data: lineas.map((linea) => ({
            producto_id: linea.producto.id,
            tipo: 'SALIDA' as const,
            cantidad: linea.cantidad,
            costo_unitario: linea.producto.costo,
            motivo: `Venta factura ${referencia}`,
            referencia,
            usuario_id: BigInt(usuario.id),
            factura_id: factura.id,
          })),
        })

        if (input.pagos.length > 0) {
          await tx.pagos.createMany({
            data: input.pagos.map((pago) => ({
              factura_id: factura.id,
              metodo: pago.metodo,
              monto: aDecimal(pago.monto),
              referencia: pago.referencia,
            })),
          })
        }

        await registrarAuditoria(tx, {
          usuarioId: usuario.id,
          accion: 'FACTURA_CREADA',
          tabla: 'facturas',
          registroId: factura.id,
          detalle: {
            referencia,
            estado,
            total: totalFactura.toString(),
            cliente_id: clienteId?.toString() ?? null,
          },
          ip,
        })

        const creada = await tx.facturas.findUniqueOrThrow({
          where: { id: factura.id },
          select: facturaDetalleSelect,
        })

        return toFacturaDetalleDTO(creada)
      },
      { timeout: 15000 },
    )
  } catch (error) {
    if (esDuplicado(error) && idempotencyKey) {
      const existente = await buscarFacturaIdempotente(usuario.id, idempotencyKey)

      if (existente) return existente
    }
    if (esDuplicado(error)) {
      throw new HttpError(
        409,
        'No se pudo asignar el número de factura, intenta nuevamente',
        'NUMERO_DUPLICADO',
      )
    }
    if (esViolacionCheck(error)) {
      throw new HttpError(409, 'Stock insuficiente para completar la factura', 'STOCK_INSUFICIENTE')
    }
    throw error
  }
}

export async function agregarPago(
  id: bigint,
  input: AgregarPagoInput,
  usuario: AuthUser,
  ip: string | null = null,
  idempotencyKey?: string,
): Promise<FacturaDetalleDTO> {
  if (idempotencyKey) {
    const pagoExistente = await prisma.pagos.findFirst({
      where: { factura_id: id, idempotency_key: idempotencyKey },
      select: { id: true },
    })

    if (pagoExistente) {
      const factura = await buscarFacturaPorId(id, usuario)

      if (!factura) {
        throw new HttpError(404, 'Factura no encontrada', 'NOT_FOUND')
      }

      return factura
    }
  }

  try {
    return await prisma.$transaction(async (tx) => {
      const bloqueo = await tx.$queryRaw<Array<{ id: bigint }>>`
        SELECT id FROM facturas WHERE id = ${id} FOR UPDATE
      `

      if (bloqueo.length === 0) {
        throw new HttpError(404, 'Factura no encontrada', 'NOT_FOUND')
      }

      const factura = await tx.facturas.findUniqueOrThrow({
        where: { id },
        include: { pagos: true },
      })

      validarAcceso(factura.usuario_id, usuario)

      if (idempotencyKey) {
        const pagoExistente = await tx.pagos.findFirst({
          where: { factura_id: id, idempotency_key: idempotencyKey },
          select: { id: true },
        })

        if (pagoExistente) {
          const actual = await tx.facturas.findUniqueOrThrow({
            where: { id },
            select: facturaDetalleSelect,
          })

          return toFacturaDetalleDTO(actual)
        }
      }

      if (factura.estado === 'ANULADA') {
        throw new HttpError(409, 'La factura está anulada', 'FACTURA_ANULADA')
      }

      if (factura.estado !== 'EMITIDA') {
        throw new HttpError(
          409,
          'La factura no admite pagos en su estado actual',
          'FACTURA_NO_PAGABLE',
        )
      }

      const pagosActuales = sumar(factura.pagos.map((pago) => aDecimal(pago.monto)))
      const nuevoMonto = redondear(aDecimal(input.monto))
      const totalPagos = redondear(pagosActuales.plus(nuevoMonto))

      if (totalPagos.gt(factura.total)) {
        throw new HttpError(
          409,
          'El pago supera el saldo pendiente de la factura',
          'PAGO_EXCEDE_TOTAL',
        )
      }

      await tx.pagos.create({
        data: {
          factura_id: id,
          metodo: input.metodo,
          monto: nuevoMonto,
          referencia: input.referencia,
          idempotency_key: idempotencyKey,
        },
      })

      if (totalPagos.eq(factura.total)) {
        await tx.facturas.update({
          where: { id },
          data: { estado: 'PAGADA' },
        })
      }

      await registrarAuditoria(tx, {
        usuarioId: usuario.id,
        accion: 'PAGO_REGISTRADO',
        tabla: 'pagos',
        registroId: id,
        detalle: {
          factura_id: id.toString(),
          metodo: input.metodo,
          monto: nuevoMonto.toString(),
          total_pagado: totalPagos.toString(),
        },
        ip,
      })

      const actualizada = await tx.facturas.findUniqueOrThrow({
        where: { id },
        select: facturaDetalleSelect,
      })

      return toFacturaDetalleDTO(actualizada)
    })
  } catch (error) {
    if (esDuplicado(error) && idempotencyKey) {
      const factura = await buscarFacturaPorId(id, usuario)

      if (factura) return factura
    }

    throw error
  }
}

export async function anularFactura(
  id: bigint,
  motivo: string,
  usuario: AuthUser,
  ip: string | null = null,
): Promise<FacturaDetalleDTO> {
  return prisma.$transaction(async (tx) => {
    const bloqueo = await tx.$queryRaw<Array<{ id: bigint }>>`
      SELECT id FROM facturas WHERE id = ${id} FOR UPDATE
    `

    if (bloqueo.length === 0) {
      throw new HttpError(404, 'Factura no encontrada', 'NOT_FOUND')
    }

    const factura = await tx.facturas.findUnique({ where: { id } })

    if (!factura) {
      throw new HttpError(404, 'Factura no encontrada', 'NOT_FOUND')
    }

    validarAcceso(factura.usuario_id, usuario)

    if (factura.cierre_id) {
      const cierres = await tx.$queryRaw<Array<{ estado: string }>>`
        SELECT estado::text AS estado
        FROM cierres_caja
        WHERE id = ${factura.cierre_id}
        FOR UPDATE
      `

      if (cierres[0]?.estado === 'CERRADO') {
        throw new HttpError(
          409,
          'No se puede anular una factura de un cierre cerrado',
          'CIERRE_CERRADO',
        )
      }
    }

    if (factura.estado === 'ANULADA') {
      throw new HttpError(409, 'La factura ya estǭ anulada', 'FACTURA_ANULADA')
    }

    if (factura.estado === 'BORRADOR') {
      throw new HttpError(409, 'La factura no ha sido emitida', 'FACTURA_NO_EMITIDA')
    }

    await tx.facturas.update({
      where: { id },
      data: {
        estado: 'ANULADA',
        anulada_en: new Date(),
        motivo_anulacion: motivo,
      },
    })

    await registrarAuditoria(tx, {
      usuarioId: usuario.id,
      accion: 'FACTURA_ANULADA',
      tabla: 'facturas',
      registroId: id,
      detalle: { motivo },
      ip,
    })

    const actualizada = await tx.facturas.findUniqueOrThrow({
      where: { id },
      select: facturaDetalleSelect,
    })

    return toFacturaDetalleDTO(actualizada)
  })
}
