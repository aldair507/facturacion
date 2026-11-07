import request from 'supertest'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp } from '../src/app.js'
import { prisma } from '../src/db/prisma.js'

const app = createApp()
const suffix = Date.now().toString()
const emailBase = `api-user-${suffix}`
const emailCajero = `${emailBase}@example.com`

let adminToken = ''
let adminId = ''
let usuarioId = ''
let cajeroToken = ''

function auth(token = adminToken) {
  return { Authorization: `Bearer ${token}` }
}

async function login(email: string, password: string) {
  return request(app).post('/api/auth/login').send({ email, password })
}

beforeAll(async () => {
  const response = await login('admin@demo.com', 'Admin123*')

  expect(response.status).toBe(200)
  adminToken = response.body.token as string
  adminId = response.body.user.id as string
})

afterAll(async () => {
  await prisma.usuarios.deleteMany({
    where: { email: { startsWith: emailBase } },
  })
  await prisma.$disconnect()
})

describe('usuarios', () => {
  it('crea un usuario y no expone el hash de la contraseña', async () => {
    const response = await request(app).post('/api/usuarios').set(auth()).send({
      nombre: 'Usuario API',
      email: emailCajero,
      password: 'Prueba123*',
      rol: 'CAJERO',
    })

    expect(response.status).toBe(201)
    expect(response.body.data).toMatchObject({
      email: emailCajero,
      rol: 'CAJERO',
      activo: true,
    })
    expect(response.body.data).not.toHaveProperty('password_hash')

    usuarioId = response.body.data.id as string
  })

  it('rechaza un email duplicado', async () => {
    const response = await request(app).post('/api/usuarios').set(auth()).send({
      nombre: 'Otro usuario',
      email: emailCajero,
      password: 'OtraClave123*',
      rol: 'CAJERO',
    })

    expect(response.status).toBe(409)
    expect(response.body.error).toBe('DUPLICADO')
  })

  it('lista y consulta usuarios sin exponer el hash', async () => {
    const listar = await request(app)
      .get('/api/usuarios')
      .query({ search: emailCajero })
      .set(auth())

    expect(listar.status).toBe(200)
    expect(listar.body.meta.total).toBe(1)
    expect(listar.body.data[0]).not.toHaveProperty('password_hash')

    const obtener = await request(app).get(`/api/usuarios/${usuarioId}`).set(auth())

    expect(obtener.status).toBe(200)
    expect(obtener.body.data.email).toBe(emailCajero)
    expect(obtener.body.data).not.toHaveProperty('password_hash')
  })

  it('permite iniciar sesión con el usuario creado', async () => {
    const response = await login(emailCajero, 'Prueba123*')

    expect(response.status).toBe(200)
    cajeroToken = response.body.token as string
    expect(cajeroToken).toBeTruthy()
  })

  it('rechaza a un CAJERO las rutas de administración de usuarios', async () => {
    const listar = await request(app).get('/api/usuarios').set(auth(cajeroToken))
    expect(listar.status).toBe(403)

    const crear = await request(app)
      .post('/api/usuarios')
      .set(auth(cajeroToken))
      .send({
        nombre: 'No permitido',
        email: `no-${suffix}@example.com`,
        password: 'Prueba123*',
        rol: 'CAJERO',
      })

    expect(crear.status).toBe(403)
  })

  it('actualiza los datos del usuario', async () => {
    const response = await request(app)
      .patch(`/api/usuarios/${usuarioId}`)
      .set(auth())
      .send({ nombre: 'Usuario actualizado' })

    expect(response.status).toBe(200)
    expect(response.body.data.nombre).toBe('Usuario actualizado')
  })

  it('permite al ADMIN restablecer la contraseña', async () => {
    const response = await request(app)
      .patch(`/api/usuarios/${usuarioId}/password`)
      .set(auth())
      .send({ password: 'Reseteada123*' })

    expect(response.status).toBe(200)

    const anterior = await login(emailCajero, 'Prueba123*')
    expect(anterior.status).toBe(401)

    const actual = await login(emailCajero, 'Reseteada123*')
    expect(actual.status).toBe(200)
    cajeroToken = actual.body.token as string
  })

  it('permite al usuario cambiar su propia contraseña', async () => {
    const response = await request(app).patch('/api/auth/password').set(auth(cajeroToken)).send({
      password_actual: 'Reseteada123*',
      password_nueva: 'Final123*',
    })

    expect(response.status).toBe(200)

    const nueva = await login(emailCajero, 'Final123*')
    expect(nueva.status).toBe(200)
  })

  it('no permite que un ADMIN se desactive a sí mismo', async () => {
    const response = await request(app)
      .patch(`/api/usuarios/${adminId}`)
      .set(auth())
      .send({ activo: false })

    expect(response.status).toBe(409)
    expect(response.body.error).toBe('SELF_DEACTIVATION')
  })

  it('valida rol y política de contraseña', async () => {
    const rolInvalido = await request(app)
      .post('/api/usuarios')
      .set(auth())
      .send({
        nombre: 'Rol inválido',
        email: `rol-${suffix}@example.com`,
        password: 'Valida123*',
        rol: 'ROOT',
      })

    expect(rolInvalido.status).toBe(422)

    const passwordDebil = await request(app)
      .post('/api/usuarios')
      .set(auth())
      .send({
        nombre: 'Clave débil',
        email: `clave-${suffix}@example.com`,
        password: '123',
        rol: 'CAJERO',
      })

    expect(passwordDebil.status).toBe(422)
  })

  it('desactiva el usuario y bloquea su login', async () => {
    const response = await request(app).delete(`/api/usuarios/${usuarioId}`).set(auth())

    expect(response.status).toBe(200)
    expect(response.body.data.activo).toBe(false)

    const bloqueado = await login(emailCajero, 'Final123*')
    expect(bloqueado.status).toBe(401)
  })
})
