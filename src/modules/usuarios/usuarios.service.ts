import { prisma } from '../../db/prisma.js'
import type { Prisma } from '../../generated/prisma/client.js'
import { registrarAuditoria } from '../../lib/auditoria.js'
import { HttpError } from '../../lib/http-error.js'
import { calcularSkip, crearMeta, type MetaPaginacion } from '../../lib/pagination.js'
import { hashearPassword } from '../../lib/password.js'
import { esDuplicado, esNoEncontrado } from '../../lib/prisma-errors.js'
import { toUsuarioDTO, type UsuarioDTO } from './usuarios.mapper.js'
import type {
  ActualizarUsuarioInput,
  CrearUsuarioInput,
  ListarUsuariosQuery,
} from './usuarios.schemas.js'

export interface ListarUsuariosResult {
  data: UsuarioDTO[]
  meta: MetaPaginacion
}

export async function listarUsuarios(params: ListarUsuariosQuery): Promise<ListarUsuariosResult> {
  const where: Prisma.usuariosWhereInput = {}

  if (params.activo !== undefined) {
    where.activo = params.activo
  }

  if (params.rol) {
    where.roles = { is: { nombre: params.rol } }
  }

  if (params.search) {
    where.OR = [
      { nombre: { contains: params.search, mode: 'insensitive' } },
      { email: { contains: params.search, mode: 'insensitive' } },
    ]
  }

  const [total, usuarios] = await prisma.$transaction([
    prisma.usuarios.count({ where }),
    prisma.usuarios.findMany({
      where,
      include: { roles: true },
      orderBy: { id: 'desc' },
      skip: calcularSkip(params),
      take: params.limit,
    }),
  ])

  return {
    data: usuarios.map(toUsuarioDTO),
    meta: crearMeta(params, total),
  }
}

export async function obtenerUsuario(id: bigint): Promise<UsuarioDTO> {
  const usuario = await prisma.usuarios.findUnique({
    where: { id },
    include: { roles: true },
  })

  if (!usuario) {
    throw new HttpError(404, 'Usuario no encontrado', 'NOT_FOUND')
  }

  return toUsuarioDTO(usuario)
}

export async function crearUsuario(
  input: CrearUsuarioInput,
  actorId?: string,
  ip: string | null = null,
): Promise<UsuarioDTO> {
  const rol = await prisma.roles.findUnique({ where: { nombre: input.rol } })

  if (!rol) {
    throw new HttpError(400, 'Rol inválido', 'INVALID_ROLE')
  }

  const password_hash = await hashearPassword(input.password)

  try {
    const usuario = await prisma.usuarios.create({
      data: {
        nombre: input.nombre,
        email: input.email,
        password_hash,
        rol_id: rol.id,
      },
      include: { roles: true },
    })

    if (actorId) {
      await registrarAuditoria(prisma, {
        usuarioId: actorId,
        accion: 'USUARIO_CREADO',
        tabla: 'usuarios',
        registroId: usuario.id,
        detalle: { email: usuario.email, rol: usuario.roles.nombre },
        ip,
      })
    }

    return toUsuarioDTO(usuario)
  } catch (error) {
    if (esDuplicado(error)) {
      throw new HttpError(409, 'Ya existe un usuario con ese email', 'DUPLICADO')
    }
    throw error
  }
}

export async function actualizarUsuario(
  id: bigint,
  input: ActualizarUsuarioInput,
  currentUserId: string,
  ip: string | null = null,
): Promise<UsuarioDTO> {
  const objetivo = await prisma.usuarios.findUnique({
    where: { id },
    include: { roles: true },
  })

  if (!objetivo) {
    throw new HttpError(404, 'Usuario no encontrado', 'NOT_FOUND')
  }

  if (objetivo.id.toString() === currentUserId) {
    if (input.activo === false) {
      throw new HttpError(409, 'No puedes desactivar tu propio usuario', 'SELF_DEACTIVATION')
    }

    if (input.rol !== undefined && input.rol !== 'ADMIN') {
      throw new HttpError(409, 'No puedes quitarte el rol ADMIN', 'SELF_DEMOTION')
    }
  }

  const pierdeAdmin =
    objetivo.roles.nombre === 'ADMIN' &&
    (input.activo === false || (input.rol !== undefined && input.rol !== 'ADMIN'))

  if (pierdeAdmin) {
    const otrosAdmins = await prisma.usuarios.count({
      where: {
        activo: true,
        id: { not: id },
        roles: { is: { nombre: 'ADMIN' } },
      },
    })

    if (otrosAdmins === 0) {
      throw new HttpError(409, 'Debe existir al menos un administrador activo', 'LAST_ADMIN')
    }
  }

  const data: Prisma.usuariosUncheckedUpdateInput = {}

  if (input.nombre !== undefined) {
    data.nombre = input.nombre
  }
  if (input.email !== undefined) {
    data.email = input.email
  }
  if (input.activo !== undefined) {
    data.activo = input.activo
  }
  if (input.activo !== undefined || input.rol !== undefined) {
    data.token_version = { increment: 1 }
  }
  if (input.rol !== undefined) {
    const rol = await prisma.roles.findUnique({ where: { nombre: input.rol } })

    if (!rol) {
      throw new HttpError(400, 'Rol inválido', 'INVALID_ROLE')
    }

    data.rol_id = rol.id
  }

  try {
    const usuario = await prisma.usuarios.update({
      where: { id },
      data,
      include: { roles: true },
    })

    const cambios: Record<string, string | boolean> = {}
    if (input.nombre !== undefined) cambios.nombre = input.nombre
    if (input.email !== undefined) cambios.email = input.email
    if (input.activo !== undefined) cambios.activo = input.activo
    if (input.rol !== undefined) cambios.rol = input.rol

    await registrarAuditoria(prisma, {
      usuarioId: currentUserId,
      accion: input.activo === false ? 'USUARIO_DESACTIVADO' : 'USUARIO_ACTUALIZADO',
      tabla: 'usuarios',
      registroId: usuario.id,
      detalle: cambios,
      ip,
    })

    return toUsuarioDTO(usuario)
  } catch (error) {
    if (esNoEncontrado(error)) {
      throw new HttpError(404, 'Usuario no encontrado', 'NOT_FOUND')
    }
    if (esDuplicado(error)) {
      throw new HttpError(409, 'Ya existe un usuario con ese email', 'DUPLICADO')
    }
    throw error
  }
}

export async function restablecerPassword(
  id: bigint,
  password: string,
  actorId?: string,
  ip: string | null = null,
): Promise<void> {
  const usuario = await prisma.usuarios.findUnique({ where: { id } })

  if (!usuario) {
    throw new HttpError(404, 'Usuario no encontrado', 'NOT_FOUND')
  }

  const password_hash = await hashearPassword(password)

  try {
    await prisma.usuarios.update({
      where: { id },
      data: {
        password_hash,
        token_version: { increment: 1 },
      },
    })

    if (actorId) {
      await registrarAuditoria(prisma, {
        usuarioId: actorId,
        accion: 'PASSWORD_RESTABLECIDA',
        tabla: 'usuarios',
        registroId: id,
        ip,
      })
    }
  } catch (error) {
    if (esNoEncontrado(error)) {
      throw new HttpError(404, 'Usuario no encontrado', 'NOT_FOUND')
    }
    throw error
  }
}

export async function desactivarUsuario(
  id: bigint,
  currentUserId: string,
  ip: string | null = null,
): Promise<UsuarioDTO> {
  return actualizarUsuario(id, { activo: false }, currentUserId, ip)
}
