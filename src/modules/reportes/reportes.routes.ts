import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { authorize } from '../../middlewares/authorize.js'
import {
  listarCierres,
  listarProductos,
  listarVentas,
  obtenerMetodosPago,
  obtenerResumen,
} from './reportes.controller.js'

export const reportesRouter = Router()

reportesRouter.use(authenticate)
reportesRouter.use(authorize('ADMIN'))

reportesRouter.get('/resumen', obtenerResumen)
reportesRouter.get('/ventas', listarVentas)
reportesRouter.get('/metodos-pago', obtenerMetodosPago)
reportesRouter.get('/productos', listarProductos)
reportesRouter.get('/cierres', listarCierres)
