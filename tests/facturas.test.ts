import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db/prisma.js'

const app = createApp()
const suffix = Date.now().toString()

let adminToken = ''
let cajeroToken = ''
let productoAId = ''
let productoBId = ''
let productoCId = ''
let facturaId = ''
let numeroFactura = 0

const facturaIds: string[] = []
const productoIds: string[] = []

function auth(token = adminToken) {
  return { Authorization: `Bearer ${token}` }
}

async function login(email: string, password: string) {
  return request(app).post('/api/auth/login').send({ email, password })
}

async function stock(productoId: string): Promise<number> {
  const response = await request(app).get(`/api/productos/${productoId}`).set(auth())
  expect(response.status).toBe(200)
  return Number(response.body.data.stock)
}

beforeAll(async () => {
  const admin = await login('admin@demo.com', 'Admin123*')
  expect(admin.status).toBe(200)
  adminToken = admin.body.token as string

  const cajero = await login('cajero@demo.com', 'Cajero123*')
  expect(cajero.status).toBe(200)
  cajeroToken = cajero.body.token as string

  const productos = [
    {
      codigo: `FAC-A-${suffix}`,
      nombre: 'Producto factura A',
      precio_venta: '1000',
      costo: '500',
      iva_pct: '19',
      stock_inicial: '10',
    },
    {
      codigo: `FAC-B-${suffix}`,
      nombre: 'Producto factura B',
      precio_venta: '2000',
      costo: '1000',
      iva_pct: '19',
      stock_inicial: '5',
    },
    {
      codigo: `FAC-C-${suffix}`,
      nombre: 'Producto factura C',
      precio_venta: '500',
      costo: '100',
      iva_pct: '0',
      stock_inicial: '3',
    },
  ]

  const creados = await Promise.all(
    productos.map((producto) => request(app).post('/api/productos').set(auth()).send(producto)),
  )

  const ids = creados.map((response) => {
    expect(response.status).toBe(201)
    productoIds.push(response.body.data.id as string)
    return response.body.data.id as string
  })

  productoAId = ids[0]!
  productoBId = ids[1]!
  productoCId = ids[2]!
})

afterAll(async () => {
  if (facturaIds.length > 0) {
    const ids = facturaIds.map((id) => BigInt(id))
    await prisma.inventario_movimientos.deleteMany({
      where: { factura_id: { in: ids } },
    })
    await prisma.facturas.deleteMany({ where: { id: { in: ids } } })
    await prisma.auditoria.deleteMany({
      where: { registro_id: { in: facturaIds } },
    })
  }

  if (productoIds.length > 0) {
    const ids = productoIds.map((id) => BigInt(id))
    await prisma.inventario_movimientos.deleteMany({
      where: { producto_id: { in: ids } },
    })
    await prisma.productos.deleteMany({ where: { id: { in: ids } } })
  }

  await prisma.$disconnect()
})

describe('facturas', () => {
  it('crea una factura EMITIDA, calcula totales y descuenta stock', async () => {
    const response = await request(app)
      .post('/api/facturas')
      .set(auth())
      .send({
        items: [
          { producto_id: productoAId, cantidad: '2', descuento: '100' },
          { producto_id: productoBId, cantidad: '1' },
        ],
        pagos: [{ metodo: 'EFECTIVO', monto: '1000' }],
      })

    expect(response.status).toBe(201)
    expect(response.body.data.estado).toBe('EMITIDA')
    expect(Number(response.body.data.subtotal)).toBe(3900)
    expect(Number(response.body.data.descuento)).toBe(100)
    expect(Number(response.body.data.iva_total)).toBe(741)
    expect(Number(response.body.data.total)).toBe(4641)
    expect(response.body.data.items).toHaveLength(2)
    expect(response.body.data.pagos).toHaveLength(1)
    expect(response.body.data.numero_completo).toContain('-')

    facturaId = response.body.data.id as string
    numeroFactura = response.body.data.numero as number
    facturaIds.push(facturaId)

    expect(await stock(productoAId)).toBe(8)
    expect(await stock(productoBId)).toBe(4)

    const auditoria = await prisma.auditoria.findFirst({
      where: { accion: 'FACTURA_CREADA', registro_id: facturaId },
    })
    expect(auditoria).not.toBeNull()
  })

  it('agrega pagos parciales y marca la factura como PAGADA', async () => {
    const excedido = await request(app)
      .post(`/api/facturas/${facturaId}/pagos`)
      .set(auth())
      .send({ metodo: 'TARJETA', monto: '99999' })

    expect(excedido.status).toBe(409)
    expect(excedido.body.error).toBe('PAGO_EXCEDE_TOTAL')

    const parcial = await request(app)
      .post(`/api/facturas/${facturaId}/pagos`)
      .set(auth())
      .send({ metodo: 'TARJETA', monto: '2000' })

    expect(parcial.status).toBe(201)
    expect(parcial.body.data.estado).toBe('EMITIDA')
    expect(parcial.body.data.pagos).toHaveLength(2)

    const final = await request(app)
      .post(`/api/facturas/${facturaId}/pagos`)
      .set(auth())
      .send({ metodo: 'TRANSFERENCIA', monto: '1641' })

    expect(final.status).toBe(201)
    expect(final.body.data.estado).toBe('PAGADA')
    expect(Number(final.body.data.pagos[2].monto)).toBe(1641)

    const pagada = await request(app)
      .post(`/api/facturas/${facturaId}/pagos`)
      .set(auth())
      .send({ metodo: 'EFECTIVO', monto: '1' })

    expect(pagada.status).toBe(409)
    expect(pagada.body.error).toBe('FACTURA_NO_PAGABLE')
  })

  it('consulta y lista la factura, y restringe el acceso del CAJERO', async () => {
    const obtener = await request(app).get(`/api/facturas/${facturaId}`).set(auth())
    expect(obtener.status).toBe(200)
    expect(obtener.body.data.id).toBe(facturaId)

    const listar = await request(app)
      .get('/api/facturas')
      .query({ numero: numeroFactura })
      .set(auth())

    expect(listar.status).toBe(200)
    expect(listar.body.meta.total).toBe(1)
    expect(listar.body.data[0].id).toBe(facturaId)

    const obtenerCajero = await request(app)
      .get(`/api/facturas/${facturaId}`)
      .set(auth(cajeroToken))
    expect(obtenerCajero.status).toBe(403)

    const listarCajero = await request(app)
      .get('/api/facturas')
      .query({ numero: numeroFactura })
      .set(auth(cajeroToken))

    expect(listarCajero.status).toBe(200)
    expect(listarCajero.body.meta.total).toBe(0)
  })

  it('reutiliza la factura y el pago cuando se repite la Idempotency-Key', async () => {
    const stockAntes = await stock(productoAId)
    const facturaKey = `idem-factura-${suffix}`
    const pagoKey = `idem-pago-${suffix}`

    const crear = () =>
      request(app)
        .post('/api/facturas')
        .set(auth(cajeroToken))
        .set('Idempotency-Key', facturaKey)
        .send({ items: [{ producto_id: productoAId, cantidad: '1' }] })

    const primera = await crear()
    const segunda = await crear()

    expect(primera.status).toBe(201)
    expect(segunda.status).toBe(201)
    expect(segunda.body.data.id).toBe(primera.body.data.id)
    expect(segunda.body.data.numero_completo).toBe(primera.body.data.numero_completo)
    expect(await stock(productoAId)).toBe(stockAntes - 1)

    const id = primera.body.data.id as string
    facturaIds.push(id)

    const pago = () =>
      request(app)
        .post(`/api/facturas/${id}/pagos`)
        .set(auth(cajeroToken))
        .set('Idempotency-Key', pagoKey)
        .send({ metodo: 'EFECTIVO', monto: '100' })

    const pagoUno = await pago()
    const pagoDos = await pago()

    expect(pagoUno.status).toBe(201)
    expect(pagoDos.status).toBe(201)
    expect(pagoDos.body.data.pagos).toHaveLength(1)
    expect(pagoDos.body.data.pagos[0].id).toBe(pagoUno.body.data.pagos[0].id)
  })

  it('rechaza un descuento superior al permitido para CAJERO', async () => {
    const response = await request(app)
      .post('/api/facturas')
      .set(auth(cajeroToken))
      .send({
        items: [{ producto_id: productoAId, cantidad: '1', descuento: '200' }],
      })

    expect(response.status).toBe(403)
    expect(response.body.error).toBe('DESCUENTO_NO_PERMITIDO')
  })

  it('permite una sola venta cuando dos solicitudes compiten por la última unidad', async () => {
    const producto = await request(app)
      .post('/api/productos')
      .set(auth())
      .send({
        codigo: `FAC-RACE-${suffix}`,
        nombre: 'Producto concurrencia',
        precio_venta: '1000',
        costo: '500',
        iva_pct: '19',
        stock_inicial: '1',
      })

    expect(producto.status).toBe(201)
    const productoId = producto.body.data.id as string
    productoIds.push(productoId)

    const vender = (key: string) =>
      request(app)
        .post('/api/facturas')
        .set(auth())
        .set('Idempotency-Key', key)
        .send({ items: [{ producto_id: productoId, cantidad: '1' }] })

    const [uno, dos] = await Promise.all([vender(`race-a-${suffix}`), vender(`race-b-${suffix}`)])

    const estados = [uno.status, dos.status].sort()
    expect(estados).toEqual([201, 409])

    const exitosa = uno.status === 201 ? uno : dos
    facturaIds.push(exitosa.body.data.id as string)
    expect(await stock(productoId)).toBe(0)
  })

  it('rechaza la venta cuando no hay stock suficiente', async () => {
    const response = await request(app)
      .post('/api/facturas')
      .set(auth())
      .send({
        items: [{ producto_id: productoBId, cantidad: '999' }],
      })

    expect(response.status).toBe(409)
    expect(response.body.error).toBe('STOCK_INSUFICIENTE')
    expect(await stock(productoBId)).toBe(4)
  })

  it('valida el método de pago y productos duplicados', async () => {
    const credito = await request(app)
      .post('/api/facturas')
      .set(auth())
      .send({
        items: [{ producto_id: productoAId, cantidad: '1' }],
        pagos: [{ metodo: 'CREDITO', monto: '100' }],
      })

    expect(credito.status).toBe(422)
    expect(credito.body.error).toBe('VALIDATION_ERROR')

    const duplicado = await request(app)
      .post('/api/facturas')
      .set(auth())
      .send({
        items: [
          { producto_id: productoAId, cantidad: '1' },
          { producto_id: productoAId, cantidad: '1' },
        ],
      })

    expect(duplicado.status).toBe(422)
  })

  it('anula la factura como ADMIN y revierte el stock', async () => {
    const crear = await request(app)
      .post('/api/facturas')
      .set(auth())
      .send({
        items: [{ producto_id: productoCId, cantidad: '2' }],
      })

    expect(crear.status).toBe(201)
    const id = crear.body.data.id as string
    facturaIds.push(id)
    expect(await stock(productoCId)).toBe(1)

    const cajero = await request(app)
      .post(`/api/facturas/${id}/anular`)
      .set(auth(cajeroToken))
      .send({ motivo: 'Anulación solicitada por el cliente' })

    expect(cajero.status).toBe(403)

    const motivoCorto = await request(app)
      .post(`/api/facturas/${id}/anular`)
      .set(auth())
      .send({ motivo: 'abc' })

    expect(motivoCorto.status).toBe(422)

    const anulada = await request(app)
      .post(`/api/facturas/${id}/anular`)
      .set(auth())
      .send({ motivo: 'Anulación solicitada por el cliente' })

    expect(anulada.status).toBe(200)
    expect(anulada.body.data.estado).toBe('ANULADA')
    expect(anulada.body.data.motivo_anulacion).toBe('Anulación solicitada por el cliente')
    expect(anulada.body.data.anulada_en).toBeTruthy()
    expect(await stock(productoCId)).toBe(3)

    const repetida = await request(app)
      .post(`/api/facturas/${id}/anular`)
      .set(auth())
      .send({ motivo: 'Intento de anulación repetida' })

    expect(repetida.status).toBe(409)
  })
})
