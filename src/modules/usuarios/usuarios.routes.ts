import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { authorize } from '../../middlewares/authorize.js'
import {
  actualizarUsuario,
  crearUsuario,
  desactivarUsuario,
  listarUsuarios,
  obtenerUsuario,
  restablecerPassword,
} from './usuarios.controller.js'

export const usuariosRouter = Router()

usuariosRouter.use(authenticate, authorize('ADMIN'))

usuariosRouter.get('/', listarUsuarios)
usuariosRouter.get('/:id', obtenerUsuario)
usuariosRouter.post('/', crearUsuario)
usuariosRouter.patch('/:id/password', restablecerPassword)
usuariosRouter.patch('/:id', actualizarUsuario)
usuariosRouter.delete('/:id', desactivarUsuario)
