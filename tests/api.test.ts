import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db/prisma.js'

const app = createApp()
const suffix = Date.now().toString()
const codigoProducto = `TEST-${suffix}`
const numDocCliente = `9${suffix.slice(-9)}`

let token = ''
let productoId = ''
let clienteId = ''

function auth() {
  return { Authorization: `Bearer ${token}` }
}

beforeAll(async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: 'admin@demo.com',
    password: 'Admin123*',
  })

  expect(response.status).toBe(200)
  token = response.body.token as string
  expect(token).toBeTruthy()
})

afterAll(async () => {
  if (productoId) {
    await prisma.inventario_movimientos.deleteMany({
      where: { producto_id: BigInt(productoId) },
    })
    await prisma.productos.deleteMany({ where: { id: BigInt(productoId) } })
  }

  if (clienteId) {
    await prisma.clientes.deleteMany({ where: { id: BigInt(clienteId) } })
  }

  await prisma.$disconnect()
})

describe('auth', () => {
  it('rechaza credenciales inválidas', async () => {
    const response = await request(app).post('/api/auth/login').send({
      email: 'admin@demo.com',
      password: 'incorrecta',
    })

    expect(response.status).toBe(401)
  })

  it('devuelve el usuario autenticado', async () => {
    const response = await request(app).get('/api/auth/me').set(auth())

    expect(response.status).toBe(200)
    expect(response.body.user).toMatchObject({
      email: 'admin@demo.com',
      rol: 'ADMIN',
    })
  })

  it('protege las rutas sin token', async () => {
    const response = await request(app).get('/api/productos')
    expect(response.status).toBe(401)
  })

  it('rechaza a un CAJERO crear productos', async () => {
    const loginCajero = await request(app).post('/api/auth/login').send({
      email: 'cajero@demo.com',
      password: 'Cajero123*',
    })
    expect(loginCajero.status).toBe(200)

    const cajeroToken = loginCajero.body.token as string

    const response = await request(app)
      .post('/api/productos')
      .set('Authorization', `Bearer ${cajeroToken}`)
      .send({ codigo: 'CAJERO-001', nombre: 'No permitido', precio_venta: '1000' })

    expect(response.status).toBe(403)
  })
})

describe('productos', () => {
  it('crea, consulta, actualiza y desactiva un producto', async () => {
    const crear = await request(app).post('/api/productos').set(auth()).send({
      codigo: codigoProducto,
      nombre: 'Producto de prueba',
      precio_venta: '1500.50',
      costo: '1000',
      iva_pct: '19',
      stock_inicial: '5',
    })

    expect(crear.status).toBe(201)
    expect(crear.body.data).toMatchObject({ codigo: codigoProducto })
    expect(Number(crear.body.data.stock)).toBe(5)
    productoId = crear.body.data.id as string

    const listar = await request(app)
      .get('/api/productos')
      .query({ search: codigoProducto })
      .set(auth())

    expect(listar.status).toBe(200)
    expect(listar.body.meta.total).toBe(1)

    const obtener = await request(app).get(`/api/productos/${productoId}`).set(auth())
    expect(obtener.status).toBe(200)
    expect(obtener.body.data.codigo).toBe(codigoProducto)

    const actualizar = await request(app)
      .patch(`/api/productos/${productoId}`)
      .set(auth())
      .send({ precio_venta: '2000' })

    expect(actualizar.status).toBe(200)
    expect(Number(actualizar.body.data.precio_venta)).toBe(2000)

    const eliminar = await request(app).delete(`/api/productos/${productoId}`).set(auth())
    expect(eliminar.status).toBe(200)
    expect(eliminar.body.data.activo).toBe(false)
  })
})

describe('clientes', () => {
  it('crea, consulta, actualiza y desactiva un cliente', async () => {
    const crear = await request(app)
      .post('/api/clientes')
      .set(auth())
      .send({
        tipo_doc: 'NIT',
        num_doc: numDocCliente,
        razon_social: 'Cliente de prueba',
        email: `test-${suffix}@example.com`,
      })

    expect(crear.status).toBe(201)
    expect(crear.body.data).toMatchObject({ num_doc: numDocCliente })
    clienteId = crear.body.data.id as string

    const obtener = await request(app).get(`/api/clientes/${clienteId}`).set(auth())
    expect(obtener.status).toBe(200)

    const actualizar = await request(app)
      .patch(`/api/clientes/${clienteId}`)
      .set(auth())
      .send({ telefono: '3001234567' })

    expect(actualizar.status).toBe(200)
    expect(actualizar.body.data.telefono).toBe('3001234567')

    const eliminar = await request(app).delete(`/api/clientes/${clienteId}`).set(auth())
    expect(eliminar.status).toBe(200)
    expect(eliminar.body.data.activo).toBe(false)
  })
})
