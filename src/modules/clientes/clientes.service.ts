import { prisma } from '../../db/prisma.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { HttpError } from '../../lib/http-error.js'
import { calcularSkip, crearMeta, type MetaPaginacion } from '../../lib/pagination.js'
import { esDuplicado, esNoEncontrado } from '../../lib/prisma-errors.js'
import { toClienteDTO, type ClienteDTO } from './clientes.mapper.js'
import type {
  ActualizarClienteInput,
  CrearClienteInput,
  ListarClientesQuery,
} from './clientes.schemas.js'

export interface ListarClientesResult {
  data: ClienteDTO[]
  meta: MetaPaginacion
}

export async function listarClientes(params: ListarClientesQuery): Promise<ListarClientesResult> {
  const where: Prisma.clientesWhereInput = {}

  if (params.activo !== undefined) {
    where.activo = params.activo
  }

  if (params.tipo_doc) {
    where.tipo_doc = params.tipo_doc
  }

  if (params.search) {
    where.OR = [
      { num_doc: { contains: params.search, mode: 'insensitive' } },
      { razon_social: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ]
  }

  const [total, clientes] = await prisma.$transaction([
    prisma.clientes.count({ where }),
    prisma.clientes.findMany({
      where,
      orderBy: { id: 'desc' },
      skip: calcularSkip(params),
      take: params.limit,
    }),
  ])

  return {
    data: clientes.map(toClienteDTO),
    meta: crearMeta(params, total),
  }
}

export async function obtenerCliente(id: bigint): Promise<ClienteDTO> {
  const cliente = await prisma.clientes.findUnique({ where: { id } })

  if (!cliente) {
    throw new HttpError(404, 'Cliente no encontrado', 'NOT_FOUND')
  }

  return toClienteDTO(cliente)
}

export async function crearCliente(input: CrearClienteInput): Promise<ClienteDTO> {
  try {
    const cliente = await prisma.clientes.create({ data: input })
    return toClienteDTO(cliente)
  } catch (error) {
    if (esDuplicado(error)) {
      throw new HttpError(
        409,
        'Ya existe un cliente con ese tipo y número de documento',
        'DUPLICADO',
      )
    }
    throw error
  }
}

export async function actualizarCliente(
  id: bigint,
  input: ActualizarClienteInput,
): Promise<ClienteDTO> {
  try {
    const cliente = await prisma.clientes.update({
      where: { id },
      data: input,
    })

    return toClienteDTO(cliente)
  } catch (error) {
    if (esNoEncontrado(error)) {
      throw new HttpError(404, 'Cliente no encontrado', 'NOT_FOUND')
    }
    if (esDuplicado(error)) {
      throw new HttpError(
        409,
        'Ya existe un cliente con ese tipo y número de documento',
        'DUPLICADO',
      )
    }
    throw error
  }
}

export async function eliminarCliente(id: bigint): Promise<ClienteDTO> {
  try {
    const cliente = await prisma.clientes.update({
      where: { id },
      data: { activo: false },
    })

    return toClienteDTO(cliente)
  } catch (error) {
    if (esNoEncontrado(error)) {
      throw new HttpError(404, 'Cliente no encontrado', 'NOT_FOUND')
    }
    throw error
  }
}
