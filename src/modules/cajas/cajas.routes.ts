import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { authorize } from '../../middlewares/authorize.js'
import {
  actualizarCaja,
  crearCaja,
  desactivarCaja,
  listarCajas,
  obtenerCaja,
} from './cajas.controller.js'

export const cajasRouter = Router()

cajasRouter.use(authenticate)

cajasRouter.get('/', listarCajas)
cajasRouter.get('/:id', obtenerCaja)
cajasRouter.post('/', authorize('ADMIN'), crearCaja)
cajasRouter.patch('/:id', authorize('ADMIN'), actualizarCaja)
cajasRouter.delete('/:id', authorize('ADMIN'), desactivarCaja)
