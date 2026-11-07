import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { authorize } from '../../middlewares/authorize.js'
import {
  crearMovimiento,
  listarMovimientos,
  listarStockBajo,
  obtenerKardex,
  obtenerValorizacion,
} from './inventario.controller.js'

export const inventarioRouter = Router()

inventarioRouter.use(authenticate)
inventarioRouter.use(authorize('ADMIN'))

inventarioRouter.get('/movimientos', listarMovimientos)
inventarioRouter.post('/movimientos', crearMovimiento)
inventarioRouter.get('/stock-bajo', listarStockBajo)
inventarioRouter.get('/valorizacion', obtenerValorizacion)
inventarioRouter.get('/productos/:id/kardex', obtenerKardex)
