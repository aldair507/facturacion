import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { prisma } from './db/prisma.js'
import { HttpError } from './lib/http-error.js'
import { errorHandler, notFoundHandler } from './middlewares/error-handler.js'
import { apiLimiter } from './middlewares/rate-limit.js'
import { requestId } from './middlewares/request-id.js'
import { requestLogger } from './middlewares/request-logger.js'
import { authRouter } from './modules/auth/auth.routes.js'
import { cajasRouter } from './modules/cajas/cajas.routes.js'
import { cierresRouter } from './modules/cierres/cierres.routes.js'
import { clientesRouter } from './modules/clientes/clientes.routes.js'
import { facturasRouter } from './modules/facturas/facturas.routes.js'
import { inventarioRouter } from './modules/inventario/inventario.routes.js'
import { productosRouter } from './modules/productos/productos.routes.js'
import { reportesRouter } from './modules/reportes/reportes.routes.js'
import { usuariosRouter } from './modules/usuarios/usuarios.routes.js'

function resolverTrustProxy(value: string): boolean | number | string {
  if (value === 'true') return true
  if (value === 'false') return false
  if (/^\d+$/.test(value)) return Number(value)
  return value
}

function sinCache(_req: express.Request, res: express.Response, next: express.NextFunction): void {
  res.setHeader('Cache-Control', 'no-store')
  next()
}

export function createApp(): express.Express {
  const app = express()
  const origenesPermitidos = env.CORS_ORIGINS.split(',')
    .map((origen) => origen.trim())
    .filter(Boolean)

  app.disable('x-powered-by')
  app.set('trust proxy', resolverTrustProxy(env.TRUST_PROXY))
  app.set('json replacer', (_key: string, value: unknown) =>
    typeof value === 'bigint' ? value.toString() : value,
  )

  app.use(requestId)
  app.use(requestLogger)
  app.use(helmet())
  app.use(
    cors({
      origin(origin, callback) {
        if (!origin || origenesPermitidos.includes('*') || origenesPermitidos.includes(origin)) {
          callback(null, true)
          return
        }

        callback(new HttpError(403, 'Origen no permitido', 'CORS_FORBIDDEN'))
      },
    }),
  )
  app.use(express.json({ limit: '1mb' }))

  app.get('/health', (_req, res) => {
    res.json({
      status: 'ok',
      service: 'facturacion',
      environment: env.NODE_ENV,
      timestamp: new Date().toISOString(),
    })
  })

  app.get('/health/ready', async (_req, res, next) => {
    try {
      await prisma.$queryRaw`SELECT 1`
      res.json({ status: 'ok', database: 'up' })
    } catch {
      next(new HttpError(503, 'Base de datos no disponible', 'SERVICE_UNAVAILABLE'))
    }
  })

  app.use('/api', apiLimiter)
  app.use('/api/auth', sinCache, authRouter)
  app.use('/api/productos', productosRouter)
  app.use('/api/clientes', clientesRouter)
  app.use('/api/usuarios', usuariosRouter)
  app.use('/api/cajas', cajasRouter)
  app.use('/api/cierres', sinCache, cierresRouter)
  app.use('/api/facturas', sinCache, facturasRouter)
  app.use('/api/inventario', sinCache, inventarioRouter)
  app.use('/api/reportes', sinCache, reportesRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)

  return app
}
