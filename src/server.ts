import { createApp } from './app.js'
import { env } from './config/env.js'
import { prisma } from './db/prisma.js'
import { logger } from './lib/logger.js'

const app = createApp()
const shutdownTimeoutMs = 10_000

const server = app.listen(env.PORT, () => {
  logger.info({ port: env.PORT, environment: env.NODE_ENV }, 'API escuchando')
})

function shutdown(signal: string): void {
  logger.info({ signal }, 'Cerrando servidor')

  const timeout = setTimeout(() => {
    logger.warn('Tiempo de cierre agotado; forzando terminación')
    server.closeAllConnections()
    void prisma.$disconnect().finally(() => process.exit(1))
  }, shutdownTimeoutMs)

  timeout.unref()

  server.close((error) => {
    clearTimeout(timeout)

    void prisma.$disconnect().finally(() => {
      if (error) {
        logger.error({ err: error }, 'Error al cerrar servidor')
        process.exit(1)
      }

      logger.info('Servidor cerrado correctamente')
      process.exit(0)
    })
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
