import { prisma } from '../db/prisma.js'
import { hashearPassword } from '../lib/password.js'
import type { RolNombre } from '../modules/auth/auth.types.js'

interface UsuarioPrueba {
  nombre: string
  email: string
  password: string
  rol: RolNombre
  activo: boolean
}

const usuarios: UsuarioPrueba[] = [
  {
    nombre: 'Administrador',
    email: 'admin@demo.com',
    password: 'Admin123*',
    rol: 'ADMIN',
    activo: true,
  },
  {
    nombre: 'Cajero de prueba',
    email: 'cajero@demo.com',
    password: 'Cajero123*',
    rol: 'CAJERO',
    activo: true,
  },
  {
    nombre: 'Usuario inactivo',
    email: 'inactivo@demo.com',
    password: 'Inactivo123*',
    rol: 'CAJERO',
    activo: false,
  },
]

async function main(): Promise<void> {
  for (const usuario of usuarios) {
    const rol = await prisma.roles.findUnique({
      where: { nombre: usuario.rol },
    })

    if (!rol) {
      throw new Error(`No existe el rol ${usuario.rol}. Ejecuta db/seed.sql antes de este script.`)
    }

    const password_hash = await hashearPassword(usuario.password)

    const creado = await prisma.usuarios.upsert({
      where: { email: usuario.email },
      create: {
        nombre: usuario.nombre,
        email: usuario.email,
        password_hash,
        rol_id: rol.id,
        activo: usuario.activo,
      },
      update: {
        nombre: usuario.nombre,
        password_hash,
        rol_id: rol.id,
        activo: usuario.activo,
      },
    })

    console.log(`OK ${creado.email} (${usuario.rol}, activo=${usuario.activo})`)
  }

  console.log('\nUsuarios de prueba listos:')
  console.log('  admin@demo.com    / Admin123*    (ADMIN)')
  console.log('  cajero@demo.com   / Cajero123*   (CAJERO)')
  console.log('  inactivo@demo.com / Inactivo123* (CAJERO inactivo)')
}

main()
  .catch((error) => {
    console.error('No se pudieron crear los usuarios de prueba:', error)
    process.exitCode = 1
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
