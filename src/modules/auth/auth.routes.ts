import { Router } from 'express'
import { authenticate } from '../../middlewares/authenticate.js'
import { loginLimiter } from '../../middlewares/rate-limit.js'
import { cambiarPasswordHandler, loginHandler, meHandler } from './auth.controller.js'

export const authRouter = Router()

authRouter.post('/login', loginLimiter, loginHandler)
authRouter.get('/me', authenticate, meHandler)
authRouter.patch('/password', authenticate, cambiarPasswordHandler)
