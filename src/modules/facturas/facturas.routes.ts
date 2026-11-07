import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { authorize } from '../../middlewares/authorize.js'
import {
  agregarPago,
  anularFactura,
  crearFactura,
  listarFacturas,
  obtenerFactura,
} from './facturas.controller.js'

export const facturasRouter = Router()

facturasRouter.use(authenticate)

facturasRouter.get('/', listarFacturas)
facturasRouter.post('/', crearFactura)
facturasRouter.get('/:id', obtenerFactura)
facturasRouter.post('/:id/pagos', agregarPago)
facturasRouter.post('/:id/anular', authorize('ADMIN'), anularFactura)
