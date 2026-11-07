export class HttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, message: string, code = 'HTTP_ERROR') {
    super(message)
    this.name = 'HttpError'
    this.status = status
    this.code = code
  }
}
