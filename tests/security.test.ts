import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db/prisma.js'

const app = createApp()
const suffix = Date.now().toString()
const email = `security-${suffix}@example.com`

let adminToken = ''
let userId = ''

function auth(token = adminToken) {
  return { Authorization: `Bearer ${token}` }
}

async function login(password: string) {
  return request(app).post('/api/auth/login').send({ email, password })
}

beforeAll(async () => {
  const response = await request(app).post('/api/auth/login').send({
    email: 'admin@demo.com',
    password: 'Admin123*',
  })

  expect(response.status).toBe(200)
  adminToken = response.body.token as string
})

afterAll(async () => {
  if (userId) {
    await prisma.auditoria.deleteMany({
      where: {
        OR: [{ usuario_id: BigInt(userId) }, { registro_id: userId }],
      },
    })
    await prisma.usuarios.deleteMany({ where: { id: BigInt(userId) } })
  }

  await prisma.$disconnect()
})

describe('seguridad y hardening', () => {
  it('expone el estado de la base de datos en /health/ready', async () => {
    const response = await request(app).get('/health/ready')

    expect(response.status).toBe(200)
    expect(response.body).toEqual({ status: 'ok', database: 'up' })
  })

  it('incluye X-Request-Id en las respuestas', async () => {
    const response = await request(app).get('/health')

    expect(response.status).toBe(200)
    expect(response.headers['x-request-id']).toMatch(/^[A-Za-z0-9._:-]{1,100}$/)
  })

  it('responde 400 cuando el JSON es inválido', async () => {
    const response = await request(app)
      .post('/api/auth/login')
      .set('Content-Type', 'application/json')
      .send('{"email":')

    expect(response.status).toBe(400)
    expect(response.body.error).toBe('INVALID_JSON')
  })

  it('aplica la allowlist de CORS', async () => {
    const bloqueado = await request(app)
      .get('/api/productos')
      .set('Origin', 'https://sitio-no-permitido.example')

    expect(bloqueado.status).toBe(403)
    expect(bloqueado.body.error).toBe('CORS_FORBIDDEN')

    const permitido = await request(app)
      .get('/api/productos')
      .set('Origin', 'http://localhost:5173')

    expect(permitido.headers['access-control-allow-origin']).toBe('http://localhost:5173')
  })

  it('invalida tokens al restablecer contraseña, cambiar rol o desactivar', async () => {
    const crear = await request(app).post('/api/usuarios').set(auth()).send({
      nombre: 'Usuario seguridad',
      email,
      password: 'Seguridad123*',
      rol: 'CAJERO',
    })

    expect(crear.status).toBe(201)
    userId = crear.body.data.id as string

    const primerLogin = await login('Seguridad123*')
    expect(primerLogin.status).toBe(200)
    const tokenInicial = primerLogin.body.token as string

    const reset = await request(app)
      .patch(`/api/usuarios/${userId}/password`)
      .set(auth())
      .send({ password: 'Reseteada123*' })

    expect(reset.status).toBe(200)

    const conTokenViejo = await request(app).get('/api/auth/me').set(auth(tokenInicial))
    expect(conTokenViejo.status).toBe(401)

    const segundoLogin = await login('Reseteada123*')
    expect(segundoLogin.status).toBe(200)
    const tokenReset = segundoLogin.body.token as string

    const cambiarRol = await request(app)
      .patch(`/api/usuarios/${userId}`)
      .set(auth())
      .send({ rol: 'ADMIN' })

    expect(cambiarRol.status).toBe(200)

    const conTokenAntesDeRol = await request(app).get('/api/auth/me').set(auth(tokenReset))
    expect(conTokenAntesDeRol.status).toBe(401)

    const tercerLogin = await login('Reseteada123*')
    expect(tercerLogin.status).toBe(200)
    const tokenAdmin = tercerLogin.body.token as string

    const desactivar = await request(app).delete(`/api/usuarios/${userId}`).set(auth())
    expect(desactivar.status).toBe(200)

    const conTokenDesactivado = await request(app).get('/api/auth/me').set(auth(tokenAdmin))
    expect(conTokenDesactivado.status).toBe(401)

    const loginDesactivado = await login('Reseteada123*')
    expect(loginDesactivado.status).toBe(401)
  })
})
