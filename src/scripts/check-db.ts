import { prisma } from '../db/prisma.js'

const [roles, usuarios, productos, cajas] = await Promise.all([
  prisma.roles.count(),
  prisma.usuarios.count(),
  prisma.productos.count(),
  prisma.cajas.count(),
])

const ventasDiarias = await prisma.v_ventas_diarias.findMany({
  take: 5,
  orderBy: { dia: 'desc' },
})

const result = { roles, usuarios, productos, cajas, ventasDiarias }

console.log(
  JSON.stringify(
    result,
    (_key, value: unknown) => (typeof value === 'bigint' ? value.toString() : value),
    2,
  ),
)

await prisma.$disconnect()
