import { prisma } from '../../db/prisma.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { HttpError } from '../../lib/http-error.js'
import { calcularSkip, crearMeta, type MetaPaginacion } from '../../lib/pagination.js'
import { esDuplicado, esNoEncontrado } from '../../lib/prisma-errors.js'
import { toProductoDTO, type ProductoDTO } from './productos.mapper.js'
import type {
  ActualizarProductoInput,
  CrearProductoInput,
  ListarProductosQuery,
} from './productos.schemas.js'

export interface ListarProductosResult {
  data: ProductoDTO[]
  meta: MetaPaginacion
}

export async function listarProductos(
  params: ListarProductosQuery,
): Promise<ListarProductosResult> {
  const where: Prisma.productosWhereInput = {}

  if (params.activo !== undefined) {
    where.activo = params.activo
  }

  if (params.search) {
    where.OR = [
      { codigo: { contains: params.search, mode: 'insensitive' } },
      { nombre: { contains: params.search, mode: 'insensitive' } },
    ]
  }

  const [total, productos] = await prisma.$transaction([
    prisma.productos.count({ where }),
    prisma.productos.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: calcularSkip(params),
      take: params.limit,
    }),
  ])

  return {
    data: productos.map(toProductoDTO),
    meta: crearMeta(params, total),
  }
}

export async function obtenerProducto(id: bigint): Promise<ProductoDTO> {
  const producto = await prisma.productos.findUnique({ where: { id } })

  if (!producto) {
    throw new HttpError(404, 'Producto no encontrado', 'NOT_FOUND')
  }

  return toProductoDTO(producto)
}

export async function crearProducto(
  input: CrearProductoInput,
  usuarioId: string,
): Promise<ProductoDTO> {
  const { stock_inicial, ...data } = input

  try {
    const producto = await prisma.$transaction(async (tx) => {
      const creado = await tx.productos.create({
        data: { ...data, stock: '0' },
      })

      if (Number(stock_inicial) > 0) {
        await tx.inventario_movimientos.create({
          data: {
            producto_id: creado.id,
            tipo: 'ENTRADA',
            cantidad: stock_inicial,
            costo_unitario: data.costo,
            motivo: 'Stock inicial',
            usuario_id: BigInt(usuarioId),
          },
        })
      }

      return tx.productos.findUniqueOrThrow({ where: { id: creado.id } })
    })

    return toProductoDTO(producto)
  } catch (error) {
    if (esDuplicado(error)) {
      throw new HttpError(409, 'Ya existe un producto con ese código', 'DUPLICADO')
    }
    throw error
  }
}

export async function actualizarProducto(
  id: bigint,
  input: ActualizarProductoInput,
): Promise<ProductoDTO> {
  try {
    const producto = await prisma.productos.update({
      where: { id },
      data: input,
    })

    return toProductoDTO(producto)
  } catch (error) {
    if (esNoEncontrado(error)) {
      throw new HttpError(404, 'Producto no encontrado', 'NOT_FOUND')
    }
    if (esDuplicado(error)) {
      throw new HttpError(409, 'Ya existe un producto con ese código', 'DUPLICADO')
    }
    throw error
  }
}

export async function eliminarProducto(id: bigint): Promise<ProductoDTO> {
  try {
    const producto = await prisma.productos.update({
      where: { id },
      data: { activo: false },
    })

    return toProductoDTO(producto)
  } catch (error) {
    if (esNoEncontrado(error)) {
      throw new HttpError(404, 'Producto no encontrado', 'NOT_FOUND')
    }
    throw error
  }
}
