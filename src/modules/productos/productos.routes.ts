import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { authorize } from '../../middlewares/authorize.js'
import {
  actualizarProducto,
  crearProducto,
  eliminarProducto,
  listarProductos,
  obtenerProducto,
} from './productos.controller.js'

export const productosRouter = Router()

productosRouter.use(authenticate)

productosRouter.get('/', listarProductos)
productosRouter.get('/:id', obtenerProducto)
productosRouter.post('/', authorize('ADMIN'), crearProducto)
productosRouter.patch('/:id', authorize('ADMIN'), actualizarProducto)
productosRouter.delete('/:id', authorize('ADMIN'), eliminarProducto)
