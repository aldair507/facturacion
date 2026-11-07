import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { abrirCierre, cerrarCierre, listarCierres, obtenerCierre } from './cierres.controller.js'

export const cierresRouter = Router()

cierresRouter.use(authenticate)

cierresRouter.get('/', listarCierres)
cierresRouter.get('/:id', obtenerCierre)
cierresRouter.post('/', abrirCierre)
cierresRouter.post('/:id/cerrar', cerrarCierre)
