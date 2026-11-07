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

const movimientoIds: string[] = []

function auth(token = adminToken) {
  return { Authorization: `Bearer ${token}` }
}

async function login(email: string, password: string) {
  return request(app).post('/api/auth/login').send({ email, password })
}

async function stock(productoId: string): Promise<string> {
  const response = await request(app).get(`/api/productos/${productoId}`).set(auth())
  expect(response.status).toBe(200)
  return response.body.data.stock as string
}

beforeAll(async () => {
  const admin = await login('admin@demo.com', 'Admin123*')
  expect(admin.status).toBe(200)
  adminToken = admin.body.token as string

  const cajero = await login('cajero@demo.com', 'Cajero123*')
  expect(cajero.status).toBe(200)
  cajeroToken = cajero.body.token as string

  const productoA = await request(app)
    .post('/api/productos')
    .set(auth())
    .send({
      codigo: `INV-A-${suffix}`,
      nombre: `Producto inventario A ${suffix}`,
      precio_venta: '1000',
      costo: '500',
      iva_pct: '0',
      stock_minimo: '3',
      stock_inicial: '10',
    })

  expect(productoA.status).toBe(201)
  productoAId = productoA.body.data.id as string

  const productoB = await request(app)
    .post('/api/productos')
    .set(auth())
    .send({
      codigo: `INV-B-${suffix}`,
      nombre: `Producto inventario B ${suffix}`,
      precio_venta: '2000',
      costo: '1000',
      iva_pct: '0',
      stock_minimo: '5',
      stock_inicial: '1',
    })

  expect(productoB.status).toBe(201)
  productoBId = productoB.body.data.id as string
})

afterAll(async () => {
  const ids = [BigInt(productoAId), BigInt(productoBId)]

  await prisma.inventario_movimientos.deleteMany({
    where: { producto_id: { in: ids } },
  })

  if (movimientoIds.length > 0) {
    await prisma.auditoria.deleteMany({
      where: { registro_id: { in: movimientoIds } },
    })
  }

  await prisma.productos.deleteMany({ where: { id: { in: ids } } })
  await prisma.$disconnect()
})

describe('inventario', () => {
  it('registra entradas, salidas y ajustes con auditoría', async () => {
    const cajero = await request(app)
      .post('/api/inventario/movimientos')
      .set(auth(cajeroToken))
      .send({
        producto_id: productoAId,
        tipo: 'ENTRADA',
        cantidad: '1',
        motivo: 'Intento de cajero',
      })

    expect(cajero.status).toBe(403)

    const entrada = await request(app)
      .post('/api/inventario/movimientos')
      .set(auth())
      .send({
        producto_id: productoAId,
        tipo: 'ENTRADA',
        cantidad: '5',
        costo_unitario: '600',
        motivo: 'Compra de prueba',
        referencia: `COMPRA-${suffix}`,
      })

    expect(entrada.status).toBe(201)
    expect(entrada.body.data.tipo).toBe('ENTRADA')
    expect(entrada.body.data.cantidad).toBe('5')
    expect(entrada.body.data.costo_unitario).toBe('600')
    expect(entrada.body.data.producto.id).toBe(productoAId)
    expect(entrada.body.data.usuario.nombre).toBeTruthy()
    movimientoIds.push(entrada.body.data.id as string)

    expect(await stock(productoAId)).toBe('15')

    const auditoria = await prisma.auditoria.findFirst({
      where: {
        accion: 'INVENTARIO_MOVIMIENTO',
        registro_id: entrada.body.data.id as string,
      },
    })

    expect(auditoria).not.toBeNull()
    expect(auditoria?.detalle).toMatchObject({
      producto_id: productoAId,
      tipo: 'ENTRADA',
      stock_antes: '10',
      stock_despues: '15',
    })

    const salida = await request(app).post('/api/inventario/movimientos').set(auth()).send({
      producto_id: productoAId,
      tipo: 'SALIDA',
      cantidad: '3',
      motivo: 'Salida de prueba',
    })

    expect(salida.status).toBe(201)
    expect(salida.body.data.tipo).toBe('SALIDA')
    movimientoIds.push(salida.body.data.id as string)
    expect(await stock(productoAId)).toBe('12')

    const ajusteNegativo = await request(app).post('/api/inventario/movimientos').set(auth()).send({
      producto_id: productoAId,
      tipo: 'AJUSTE',
      cantidad: '-2',
      motivo: 'Ajuste negativo de prueba',
    })

    expect(ajusteNegativo.status).toBe(201)
    expect(ajusteNegativo.body.data.cantidad).toBe('-2')
    movimientoIds.push(ajusteNegativo.body.data.id as string)
    expect(await stock(productoAId)).toBe('10')

    const ajustePositivo = await request(app).post('/api/inventario/movimientos').set(auth()).send({
      producto_id: productoAId,
      tipo: 'AJUSTE',
      cantidad: '1',
      motivo: 'Ajuste positivo de prueba',
    })

    expect(ajustePositivo.status).toBe(201)
    movimientoIds.push(ajustePositivo.body.data.id as string)
    expect(await stock(productoAId)).toBe('11')
  })

  it('valida stock, producto y cantidad del movimiento', async () => {
    const insuficiente = await request(app).post('/api/inventario/movimientos').set(auth()).send({
      producto_id: productoAId,
      tipo: 'SALIDA',
      cantidad: '999',
      motivo: 'Salida sin stock suficiente',
    })

    expect(insuficiente.status).toBe(409)
    expect(insuficiente.body.error).toBe('STOCK_INSUFICIENTE')
    expect(await stock(productoAId)).toBe('11')

    const cero = await request(app).post('/api/inventario/movimientos').set(auth()).send({
      producto_id: productoAId,
      tipo: 'AJUSTE',
      cantidad: '0',
      motivo: 'Ajuste cero de prueba',
    })

    expect(cero.status).toBe(422)
    expect(cero.body.error).toBe('VALIDATION_ERROR')

    const inexistente = await request(app).post('/api/inventario/movimientos').set(auth()).send({
      producto_id: '9223372036854775807',
      tipo: 'ENTRADA',
      cantidad: '1',
      motivo: 'Producto inexistente',
    })

    expect(inexistente.status).toBe(404)
    expect(inexistente.body.error).toBe('PRODUCTO_NO_ENCONTRADO')
  })

  it('consulta movimientos, kardex, stock bajo y valorización', async () => {
    const movimientos = await request(app)
      .get('/api/inventario/movimientos')
      .query({ producto_id: productoAId, limit: 100 })
      .set(auth())

    expect(movimientos.status).toBe(200)
    expect(movimientos.body.meta.total).toBe(5)
    expect(movimientos.body.data[0].tipo).toBe('AJUSTE')
    expect(movimientos.body.data[0].cantidad).toBe('1')

    const entradas = await request(app)
      .get('/api/inventario/movimientos')
      .query({ producto_id: productoAId, tipo: 'ENTRADA' })
      .set(auth())

    expect(entradas.status).toBe(200)
    expect(entradas.body.meta.total).toBe(2)

    const kardex = await request(app)
      .get(`/api/inventario/productos/${productoAId}/kardex`)
      .query({ limit: 100 })
      .set(auth())

    expect(kardex.status).toBe(200)
    expect(kardex.body.meta.total).toBe(5)
    expect(kardex.body.data).toHaveLength(5)
    expect(kardex.body.data[0].saldo).toBe('11')
    expect(kardex.body.data[4].saldo).toBe('10')

    const bajo = await request(app)
      .get('/api/inventario/stock-bajo')
      .query({ search: suffix })
      .set(auth())

    expect(bajo.status).toBe(200)
    expect(bajo.body.meta.total).toBe(1)
    expect(bajo.body.data[0].id).toBe(productoBId)
    expect(bajo.body.data[0].faltante).toBe('4')

    const valorizacion = await request(app).get('/api/inventario/valorizacion').set(auth())

    expect(valorizacion.status).toBe(200)
    expect(Number(valorizacion.body.data.productos)).toBeGreaterThanOrEqual(2)
    expect(Number(valorizacion.body.data.valor_costo)).toBeGreaterThan(0)
    expect(Number(valorizacion.body.data.valor_venta)).toBeGreaterThan(0)
  })

  it('bloquea movimientos sobre productos inactivos', async () => {
    const desactivar = await request(app).delete(`/api/productos/${productoBId}`).set(auth())

    expect(desactivar.status).toBe(200)
    expect(desactivar.body.data.activo).toBe(false)

    const inactivo = await request(app).post('/api/inventario/movimientos').set(auth()).send({
      producto_id: productoBId,
      tipo: 'ENTRADA',
      cantidad: '1',
      motivo: 'Entrada sobre producto inactivo',
    })

    expect(inactivo.status).toBe(409)
    expect(inactivo.body.error).toBe('PRODUCTO_INACTIVO')

    const bajo = await request(app)
      .get('/api/inventario/stock-bajo')
      .query({ search: suffix })
      .set(auth())

    expect(bajo.status).toBe(200)
    expect(bajo.body.meta.total).toBe(0)
  })
})
