import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db/prisma.js'

const app = createApp()
const suffix = Date.now().toString()

let adminToken = ''
let cajeroToken = ''
let cajaId: number | null = null
let cierreId = ''
let productoAId = ''
let productoBId = ''
let factura1Id = ''
let factura2Id = ''

const facturaIds: string[] = []
const productoIds: string[] = []

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
    .send({ nombre: `Caja Reportes ${suffix}` })

  expect(caja.status).toBe(201)
  cajaId = caja.body.data.id as number

  const abrir = await request(app)
    .post('/api/cierres')
    .set(auth())
    .send({ caja_id: cajaId, base_inicial: '0' })

  expect(abrir.status).toBe(201)
  cierreId = abrir.body.data.id as string

  const productos = await Promise.all([
    request(app)
      .post('/api/productos')
      .set(auth())
      .send({
        codigo: `REP-A-${suffix}`,
        nombre: `Producto reportes A ${suffix}`,
        precio_venta: '1000',
        costo: '500',
        iva_pct: '0',
        stock_minimo: '2',
        stock_inicial: '10',
      }),
    request(app)
      .post('/api/productos')
      .set(auth())
      .send({
        codigo: `REP-B-${suffix}`,
        nombre: `Producto reportes B ${suffix}`,
        precio_venta: '2000',
        costo: '1000',
        iva_pct: '0',
        stock_minimo: '1',
        stock_inicial: '5',
      }),
  ])

  for (const producto of productos) {
    expect(producto.status).toBe(201)
    productoIds.push(producto.body.data.id as string)
  }

  productoAId = productoIds[0]!
  productoBId = productoIds[1]!

  const factura1 = await request(app)
    .post('/api/facturas')
    .set(auth())
    .send({
      caja_id: cajaId,
      items: [
        { producto_id: productoAId, cantidad: '2' },
        { producto_id: productoBId, cantidad: '1' },
      ],
      pagos: [{ metodo: 'EFECTIVO', monto: '2500' }],
    })

  expect(factura1.status).toBe(201)
  expect(factura1.body.data.estado).toBe('EMITIDA')
  expect(factura1.body.data.cierre_id).toBe(cierreId)
  factura1Id = factura1.body.data.id as string
  facturaIds.push(factura1Id)

  const factura2 = await request(app)
    .post('/api/facturas')
    .set(auth())
    .send({
      caja_id: cajaId,
      items: [{ producto_id: productoAId, cantidad: '1' }],
      pagos: [{ metodo: 'TARJETA', monto: '1000' }],
    })

  expect(factura2.status).toBe(201)
  expect(factura2.body.data.estado).toBe('PAGADA')
  factura2Id = factura2.body.data.id as string
  facturaIds.push(factura2Id)
})

afterAll(async () => {
  const productoIdsBigInt = productoIds.map((id) => BigInt(id))

  await prisma.inventario_movimientos.deleteMany({
    where: { producto_id: { in: productoIdsBigInt } },
  })

  if (facturaIds.length > 0) {
    const ids = facturaIds.map((id) => BigInt(id))
    await prisma.facturas.deleteMany({ where: { id: { in: ids } } })
  }

  if (cajaId !== null) {
    await prisma.cierres_caja.deleteMany({ where: { caja_id: cajaId } })
    await prisma.cajas.deleteMany({ where: { id: cajaId } })
  }

  if (productoIdsBigInt.length > 0) {
    await prisma.productos.deleteMany({ where: { id: { in: productoIdsBigInt } } })
  }

  await prisma.auditoria.deleteMany({
    where: { registro_id: { in: [...facturaIds, cierreId] } },
  })

  await prisma.$disconnect()
})

describe('reportes', () => {
  it('calcula el resumen de ventas, cobros y saldos', async () => {
    const resumen = await request(app)
      .get('/api/reportes/resumen')
      .query({ caja_id: cajaId })
      .set(auth())

    expect(resumen.status).toBe(200)
    expect(resumen.body.data.facturas).toBe(2)
    expect(Number(resumen.body.data.facturado)).toBe(5000)
    expect(Number(resumen.body.data.cobrado)).toBe(3500)
    expect(Number(resumen.body.data.pendiente)).toBe(1500)
    expect(Number(resumen.body.data.ticket_promedio)).toBe(2500)
  })

  it('lista ventas con cliente, caja, pagos y saldo pendiente', async () => {
    const ventas = await request(app)
      .get('/api/reportes/ventas')
      .query({ caja_id: cajaId, limit: 10 })
      .set(auth())

    expect(ventas.status).toBe(200)
    expect(ventas.body.meta.total).toBe(2)

    const venta1 = ventas.body.data.find((venta: { id: string }) => venta.id === factura1Id)
    const venta2 = ventas.body.data.find((venta: { id: string }) => venta.id === factura2Id)

    expect(venta1).toBeTruthy()
    expect(venta2).toBeTruthy()
    expect(Number(venta1.total)).toBe(4000)
    expect(Number(venta1.pagado)).toBe(2500)
    expect(Number(venta1.saldo_pendiente)).toBe(1500)
    expect(venta1.metodos_pago).toEqual(['EFECTIVO'])
    expect(venta1.caja.id).toBe(cajaId)
    expect(venta2.estado).toBe('PAGADA')
    expect(venta2.metodos_pago).toEqual(['TARJETA'])

    const paginado = await request(app)
      .get('/api/reportes/ventas')
      .query({ caja_id: cajaId, limit: 1 })
      .set(auth())

    expect(paginado.status).toBe(200)
    expect(paginado.body.data).toHaveLength(1)
    expect(paginado.body.meta.total).toBe(2)
    expect(paginado.body.meta.totalPages).toBe(2)
  })

  it('agrupa los pagos por método en el período', async () => {
    const metodos = await request(app)
      .get('/api/reportes/metodos-pago')
      .query({ caja_id: cajaId })
      .set(auth())

    expect(metodos.status).toBe(200)
    expect(metodos.body.data).toHaveLength(2)

    const efectivo = metodos.body.data.find(
      (fila: { metodo: string }) => fila.metodo === 'EFECTIVO',
    )
    const tarjeta = metodos.body.data.find((fila: { metodo: string }) => fila.metodo === 'TARJETA')

    expect(efectivo.pagos).toBe(1)
    expect(Number(efectivo.total)).toBe(2500)
    expect(tarjeta.pagos).toBe(1)
    expect(Number(tarjeta.total)).toBe(1000)
  })

  it('calcula productos vendidos y margen estimado con costo histórico', async () => {
    const productos = await request(app)
      .get('/api/reportes/productos')
      .query({ caja_id: cajaId, limit: 10 })
      .set(auth())

    expect(productos.status).toBe(200)
    expect(productos.body.meta.total).toBe(2)

    const productoA = productos.body.data.find(
      (fila: { producto_id: string }) => fila.producto_id === productoAId,
    )
    const productoB = productos.body.data.find(
      (fila: { producto_id: string }) => fila.producto_id === productoBId,
    )

    expect(Number(productoA.cantidad)).toBe(3)
    expect(Number(productoA.subtotal)).toBe(3000)
    expect(Number(productoA.costo_estimado)).toBe(1500)
    expect(Number(productoA.margen_estimado)).toBe(1500)
    expect(Number(productoA.margen_porcentaje)).toBe(50)

    expect(Number(productoB.cantidad)).toBe(1)
    expect(Number(productoB.subtotal)).toBe(2000)
    expect(Number(productoB.costo_estimado)).toBe(1000)
    expect(Number(productoB.margen_estimado)).toBe(1000)
  })

  it('exporta reportes en CSV y restringe el acceso a ADMIN', async () => {
    const csv = await request(app)
      .get('/api/reportes/ventas')
      .query({ caja_id: cajaId, format: 'csv' })
      .set(auth())

    expect(csv.status).toBe(200)
    expect(csv.headers['content-type']).toContain('text/csv')
    expect(csv.headers['content-disposition']).toContain('attachment')
    expect(csv.text).toContain('Factura')
    expect(csv.text).toContain('EFECTIVO')

    const cajero = await request(app).get('/api/reportes/resumen').set(auth(cajeroToken))

    expect(cajero.status).toBe(403)
    expect(cajero.body.error).toBe('FORBIDDEN')

    const rangoInvalido = await request(app)
      .get('/api/reportes/ventas')
      .query({ desde: '2030-01-02', hasta: '2030-01-01' })
      .set(auth())

    expect(rangoInvalido.status).toBe(422)
    expect(rangoInvalido.body.error).toBe('VALIDATION_ERROR')
  })

  it('reporta el cierre de caja con sus totales y arqueo', async () => {
    const pago = await request(app)
      .post(`/api/facturas/${factura1Id}/pagos`)
      .set(auth())
      .send({ metodo: 'TARJETA', monto: '1500' })

    expect(pago.status).toBe(201)
    expect(pago.body.data.estado).toBe('PAGADA')

    const cerrar = await request(app)
      .post(`/api/cierres/${cierreId}/cerrar`)
      .set(auth())
      .send({ efectivo_contado: '2500' })

    expect(cerrar.status).toBe(200)
    expect(Number(cerrar.body.data.total_ventas)).toBe(5000)
    expect(Number(cerrar.body.data.total_efectivo)).toBe(2500)
    expect(Number(cerrar.body.data.total_otros)).toBe(2500)

    const cierres = await request(app)
      .get('/api/reportes/cierres')
      .query({ caja_id: cajaId, estado: 'CERRADO' })
      .set(auth())

    expect(cierres.status).toBe(200)
    expect(cierres.body.meta.total).toBe(1)

    const cierre = cierres.body.data[0]
    expect(cierre.id).toBe(cierreId)
    expect(cierre.estado).toBe('CERRADO')
    expect(Number(cierre.total_ventas)).toBe(5000)
    expect(Number(cierre.total_efectivo)).toBe(2500)
    expect(Number(cierre.total_otros)).toBe(2500)
    expect(Number(cierre.efectivo_esperado)).toBe(2500)
    expect(Number(cierre.efectivo_contado)).toBe(2500)
    expect(Number(cierre.diferencia)).toBe(0)
    expect(cierre.cantidad_facturas).toBe(2)

    const resumen = await request(app)
      .get('/api/reportes/resumen')
      .query({ caja_id: cajaId })
      .set(auth())

    expect(Number(resumen.body.data.cobrado)).toBe(5000)
    expect(Number(resumen.body.data.pendiente)).toBe(0)
  })
})
