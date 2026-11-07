import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db/prisma.js'

const app = createApp()
const suffix = Date.now().toString()

let adminToken = ''
let cajeroToken = ''
let cajaId: number | null = null
let productoId: string | null = null
let cierreId = ''
let segundoCierreId = ''

const facturaIds: string[] = []
const cierreIds: string[] = []

function auth(token = adminToken) {
  return { Authorization: `Bearer ${token}` }
}

async function login(email: string, password: string) {
  return request(app).post('/api/auth/login').send({ email, password })
}

beforeAll(async () => {
  const admin = await login('admin@demo.com', 'Admin123*')
  expect(admin.status).toBe(200)
  adminToken = admin.body.token as string

  const cajero = await login('cajero@demo.com', 'Cajero123*')
  expect(cajero.status).toBe(200)
  cajeroToken = cajero.body.token as string

  const caja = await request(app)
    .post('/api/cajas')
    .set(auth())
    .send({ nombre: `Caja Test ${suffix}` })

  expect(caja.status).toBe(201)
  cajaId = caja.body.data.id as number

  const producto = await request(app)
    .post('/api/productos')
    .set(auth())
    .send({
      codigo: `CAJA-PROD-${suffix}`,
      nombre: 'Producto cierre de caja',
      precio_venta: '1000',
      costo: '500',
      iva_pct: '0',
      stock_inicial: '10',
    })

  expect(producto.status).toBe(201)
  productoId = producto.body.data.id as string
})

afterAll(async () => {
  if (facturaIds.length > 0) {
    const ids = facturaIds.map((id) => BigInt(id))
    await prisma.inventario_movimientos.deleteMany({
      where: { factura_id: { in: ids } },
    })
    await prisma.facturas.deleteMany({ where: { id: { in: ids } } })
  }

  if (cajaId !== null) {
    await prisma.cierres_caja.deleteMany({ where: { caja_id: cajaId } })
    await prisma.cajas.deleteMany({ where: { id: cajaId } })
  }

  if (productoId) {
    const id = BigInt(productoId)
    await prisma.inventario_movimientos.deleteMany({
      where: { producto_id: id },
    })
    await prisma.productos.deleteMany({ where: { id } })
  }

  await prisma.auditoria.deleteMany({
    where: {
      OR: [
        { registro_id: { in: [...facturaIds, ...cierreIds] } },
        ...(cajaId !== null ? [{ registro_id: String(cajaId) }] : []),
      ],
    },
  })

  await prisma.$disconnect()
})

describe('cajas y cierres', () => {
  it('gestiona cajas y restringe las acciones de escritura a ADMIN', async () => {
    const cajero = await request(app)
      .post('/api/cajas')
      .set(auth(cajeroToken))
      .send({ nombre: `Caja Cajero ${suffix}` })

    expect(cajero.status).toBe(403)

    const obtener = await request(app).get(`/api/cajas/${cajaId}`).set(auth())
    expect(obtener.status).toBe(200)
    expect(obtener.body.data.activo).toBe(true)
    expect(obtener.body.data.cierre_abierto).toBeNull()

    const listar = await request(app)
      .get('/api/cajas')
      .query({ search: suffix })
      .set(auth(cajeroToken))

    expect(listar.status).toBe(200)
    expect(listar.body.meta.total).toBe(1)
    expect(listar.body.data[0].id).toBe(cajaId)

    const actualizar = await request(app)
      .patch(`/api/cajas/${cajaId}`)
      .set(auth())
      .send({ nombre: `Caja Test ${suffix} editada` })

    expect(actualizar.status).toBe(200)
    expect(actualizar.body.data.nombre).toContain('editada')
  })

  it('abre un único cierre y bloquea el cierre con facturas pendientes', async () => {
    const abrir = await request(app)
      .post('/api/cierres')
      .set(auth(cajeroToken))
      .send({ caja_id: cajaId, base_inicial: '1000' })

    expect(abrir.status).toBe(201)
    expect(abrir.body.data.estado).toBe('ABIERTO')
    expect(abrir.body.data.base_inicial).toBe('1000')
    expect(abrir.body.data.cantidad_facturas).toBe(0)

    cierreId = abrir.body.data.id as string
    cierreIds.push(cierreId)

    const repetido = await request(app).post('/api/cierres').set(auth()).send({ caja_id: cajaId })

    expect(repetido.status).toBe(409)
    expect(repetido.body.error).toBe('CIERRE_YA_ABIERTO')

    const caja = await request(app).get(`/api/cajas/${cajaId}`).set(auth())
    expect(caja.body.data.cierre_abierto.id).toBe(cierreId)

    const factura = await request(app)
      .post('/api/facturas')
      .set(auth(cajeroToken))
      .send({
        caja_id: cajaId,
        items: [{ producto_id: productoId, cantidad: '2' }],
        pagos: [{ metodo: 'EFECTIVO', monto: '500' }],
      })

    expect(factura.status).toBe(201)
    expect(factura.body.data.estado).toBe('EMITIDA')
    expect(factura.body.data.cierre_id).toBe(cierreId)
    facturaIds.push(factura.body.data.id as string)

    const bloqueado = await request(app)
      .post(`/api/cierres/${cierreId}/cerrar`)
      .set(auth(cajeroToken))
      .send({ efectivo_contado: '1500' })

    expect(bloqueado.status).toBe(409)
    expect(bloqueado.body.error).toBe('CIERRE_CON_FACTURAS_PENDIENTES')

    const pago = await request(app)
      .post(`/api/facturas/${factura.body.data.id}/pagos`)
      .set(auth(cajeroToken))
      .send({ metodo: 'TARJETA', monto: '1500' })

    expect(pago.status).toBe(201)
    expect(pago.body.data.estado).toBe('PAGADA')

    const segundo = await request(app)
      .post('/api/facturas')
      .set(auth(cajeroToken))
      .send({
        caja_id: cajaId,
        items: [{ producto_id: productoId, cantidad: '1' }],
        pagos: [{ metodo: 'EFECTIVO', monto: '1000' }],
      })

    expect(segundo.status).toBe(201)
    expect(segundo.body.data.estado).toBe('PAGADA')
    expect(segundo.body.data.cierre_id).toBe(cierreId)
    facturaIds.push(segundo.body.data.id as string)

    const abierto = await request(app).get(`/api/cierres/${cierreId}`).set(auth())

    expect(abierto.status).toBe(200)
    expect(abierto.body.data.total_ventas).toBe('3000')
    expect(abierto.body.data.total_efectivo).toBe('1500')
    expect(abierto.body.data.total_otros).toBe('1500')
    expect(abierto.body.data.efectivo_esperado).toBe('2500')

    const abiertos = await request(app)
      .get('/api/cierres')
      .query({ caja_id: cajaId, estado: 'ABIERTO' })
      .set(auth())

    expect(abiertos.status).toBe(200)
    expect(abiertos.body.data[0].total_ventas).toBe('3000')
    expect(abiertos.body.data[0].total_efectivo).toBe('1500')
    expect(abiertos.body.data[0].total_otros).toBe('1500')
    expect(abiertos.body.data[0].efectivo_esperado).toBe('2500')
  })

  it('cierra el cierre, calcula el arqueo y bloquea ventas y anulaciones', async () => {
    const cerrar = await request(app)
      .post(`/api/cierres/${cierreId}/cerrar`)
      .set(auth(cajeroToken))
      .send({ efectivo_contado: '2400', observaciones: 'Faltante de 100' })

    expect(cerrar.status).toBe(200)
    expect(cerrar.body.data.estado).toBe('CERRADO')
    expect(cerrar.body.data.total_ventas).toBe('3000')
    expect(cerrar.body.data.total_efectivo).toBe('1500')
    expect(cerrar.body.data.total_otros).toBe('1500')
    expect(cerrar.body.data.efectivo_esperado).toBe('2500')
    expect(cerrar.body.data.efectivo_contado).toBe('2400')
    expect(cerrar.body.data.diferencia).toBe('-100')
    expect(cerrar.body.data.cantidad_facturas).toBe(2)
    expect(cerrar.body.data.observaciones).toBe('Faltante de 100')

    const listar = await request(app)
      .get('/api/cierres')
      .query({ caja_id: cajaId, estado: 'CERRADO' })
      .set(auth())

    expect(listar.status).toBe(200)
    expect(listar.body.meta.total).toBe(1)
    expect(listar.body.data[0].id).toBe(cierreId)

    const repetido = await request(app)
      .post(`/api/cierres/${cierreId}/cerrar`)
      .set(auth())
      .send({ efectivo_contado: '2500' })

    expect(repetido.status).toBe(409)
    expect(repetido.body.error).toBe('CIERRE_CERRADO')

    const ventaCerrada = await request(app)
      .post('/api/facturas')
      .set(auth())
      .send({
        caja_id: cajaId,
        items: [{ producto_id: productoId, cantidad: '1' }],
        pagos: [{ metodo: 'EFECTIVO', monto: '1000' }],
      })

    expect(ventaCerrada.status).toBe(409)
    expect(ventaCerrada.body.error).toBe('CAJA_SIN_CIERRE_ABIERTO')

    const anular = await request(app)
      .post(`/api/facturas/${facturaIds[1]}/anular`)
      .set(auth())
      .send({ motivo: 'Intento de anulación en cierre cerrado' })

    expect(anular.status).toBe(409)
    expect(anular.body.error).toBe('CIERRE_CERRADO')
  })

  it('permite cerrar solo al dueño CAJERO y desactivar una caja sin cierre abierto', async () => {
    const abrir = await request(app).post('/api/cierres').set(auth()).send({ caja_id: cajaId })

    expect(abrir.status).toBe(201)
    segundoCierreId = abrir.body.data.id as string
    cierreIds.push(segundoCierreId)

    const facturaAjena = await request(app)
      .post('/api/facturas')
      .set(auth(cajeroToken))
      .send({
        caja_id: cajaId,
        items: [{ producto_id: productoId, cantidad: '1' }],
        pagos: [{ metodo: 'EFECTIVO', monto: '1000' }],
      })

    expect(facturaAjena.status).toBe(403)
    expect(facturaAjena.body.error).toBe('CIERRE_NO_PROPIO')

    const cajero = await request(app)
      .post(`/api/cierres/${segundoCierreId}/cerrar`)
      .set(auth(cajeroToken))
      .send({ efectivo_contado: '0' })

    expect(cajero.status).toBe(403)

    const inactiva = await request(app).delete(`/api/cajas/${cajaId}`).set(auth())

    expect(inactiva.status).toBe(409)
    expect(inactiva.body.error).toBe('CAJA_CON_CIERRE_ABIERTO')

    const cerrar = await request(app)
      .post(`/api/cierres/${segundoCierreId}/cerrar`)
      .set(auth())
      .send({ efectivo_contado: '0' })

    expect(cerrar.status).toBe(200)
    expect(cerrar.body.data.total_ventas).toBe('0')
    expect(cerrar.body.data.total_efectivo).toBe('0')
    expect(cerrar.body.data.efectivo_esperado).toBe('0')
    expect(cerrar.body.data.diferencia).toBe('0')
    expect(cerrar.body.data.cantidad_facturas).toBe(0)

    const desactivar = await request(app).delete(`/api/cajas/${cajaId}`).set(auth())

    expect(desactivar.status).toBe(200)
    expect(desactivar.body.data.activo).toBe(false)

    const abrirInactiva = await request(app)
      .post('/api/cierres')
      .set(auth())
      .send({ caja_id: cajaId })

    expect(abrirInactiva.status).toBe(409)
    expect(abrirInactiva.body.error).toBe('CAJA_INACTIVA')
  })
})
