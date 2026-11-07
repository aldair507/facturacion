import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { authorize } from '../../middlewares/authorize.js'
import {
  actualizarCliente,
  crearCliente,
  eliminarCliente,
  listarClientes,
  obtenerCliente,
} from './clientes.controller.js'

export const clientesRouter = Router()

clientesRouter.use(authenticate)

clientesRouter.get('/', listarClientes)
clientesRouter.get('/:id', obtenerCliente)
clientesRouter.post('/', crearCliente)
clientesRouter.patch('/:id', actualizarCliente)
clientesRouter.delete('/:id', authorize('ADMIN'), eliminarCliente)
