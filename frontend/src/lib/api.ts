export type QueryValue = string | number | boolean | null | undefined

export type QueryParams = Record<string, QueryValue>

const tokenKey = 'facturacion_token'
const apiUrl = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api'

export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details: unknown

  constructor(status: number, message: string, code = 'HTTP_ERROR', details?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.details = details
  }
}

export function getToken(): string | null {
  return localStorage.getItem(tokenKey)
}

export function setToken(token: string): void {
  localStorage.setItem(tokenKey, token)
}

export function clearToken(): void {
  localStorage.removeItem(tokenKey)
}

export function toQuery(params: QueryParams = {}): string {
  const search = new URLSearchParams()

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== '') {
      search.set(key, String(value))
    }
  }

  const query = search.toString()
  return query ? `?${query}` : ''
}

async function parseError(response: Response): Promise<ApiError> {
  try {
    const body = (await response.json()) as {
      error?: string
      message?: string
      details?: unknown
    }
    return new ApiError(
      response.status,
      body.message ?? 'La solicitud falló',
      body.error ?? 'HTTP_ERROR',
      body.details,
    )
  } catch {
    return new ApiError(response.status, 'La solicitud falló', 'HTTP_ERROR')
  }
}

async function request<T>(
  path: string,
  options: RequestInit = {},
  params?: QueryParams,
): Promise<T> {
  const token = getToken()
  const headers = new Headers(options.headers)
  headers.set('Accept', 'application/json')

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${apiUrl}${path}${toQuery(params)}`, {
    ...options,
    headers,
  })

  if (response.status === 401 && path !== '/auth/login') {
    window.dispatchEvent(new Event('auth:expired'))
  }

  if (!response.ok) {
    throw await parseError(response)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return (await response.json()) as T
}

async function download(path: string, params?: QueryParams, fallbackName = 'reporte.csv') {
  const token = getToken()
  const headers = new Headers()

  if (token) {
    headers.set('Authorization', `Bearer ${token}`)
  }

  const response = await fetch(`${apiUrl}${path}${toQuery(params)}`, { headers })

  if (!response.ok) {
    throw await parseError(response)
  }

  const disposition = response.headers.get('content-disposition') ?? ''
  const match = /filename="?([^";]+)"?/.exec(disposition)
  const filename = match?.[1] ?? fallbackName
  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.append(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}

export const api = {
  get<T>(path: string, params?: QueryParams): Promise<T> {
    return request<T>(path, { method: 'GET' }, params)
  },
  post<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    return request<T>(path, {
      method: 'POST',
      headers: extraHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  },
  patch<T>(path: string, body?: unknown, extraHeaders?: Record<string, string>): Promise<T> {
    return request<T>(path, {
      method: 'PATCH',
      headers: extraHeaders,
      body: body === undefined ? undefined : JSON.stringify(body),
    })
  },
  delete<T>(path: string): Promise<T> {
    return request<T>(path, { method: 'DELETE' })
  },
  download,
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof ApiError) {
    return error.message
  }
  if (error instanceof Error) {
    return error.message
  }
  return 'Ocurrió un error inesperado'
}
