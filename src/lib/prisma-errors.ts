interface PrismaErrorLike {
  code?: string
  message?: string
}

function getCode(error: unknown): string | undefined {
  if (typeof error !== 'object' || error === null || !('code' in error)) {
    return undefined
  }
  return (error as PrismaErrorLike).code
}

function getMessage(error: unknown): string {
  if (typeof error !== 'object' || error === null || !('message' in error)) {
    return ''
  }
  return String((error as PrismaErrorLike).message)
}

export function esDuplicado(error: unknown): boolean {
  return getCode(error) === 'P2002'
}

export function esNoEncontrado(error: unknown): boolean {
  return getCode(error) === 'P2025'
}

export function esViolacionCheck(error: unknown): boolean {
  const code = getCode(error)

  if (code !== 'P2004' && code !== 'P2010') {
    return false
  }

  return /check constraint|productos_stock_no_negativo|23514/i.test(getMessage(error))
}
