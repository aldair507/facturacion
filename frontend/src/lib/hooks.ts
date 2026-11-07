import { useCallback, useEffect, useState } from 'react'
import { api, getErrorMessage } from './api'

export function useResource<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(Boolean(path))
  const [error, setError] = useState<string | null>(null)
  const [version, setVersion] = useState(0)

  const reload = useCallback(() => {
    setVersion((current) => current + 1)
  }, [])

  useEffect(() => {
    if (!path) {
      setData(null)
      setLoading(false)
      return
    }

    let activo = true
    setLoading(true)
    setError(null)

    api
      .get<T>(path)
      .then((response) => {
        if (activo) setData(response)
      })
      .catch((requestError: unknown) => {
        if (activo) setError(getErrorMessage(requestError))
      })
      .finally(() => {
        if (activo) setLoading(false)
      })

    return () => {
      activo = false
    }
  }, [path, version])

  return { data, loading, error, reload }
}

export function useAction() {
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const run = useCallback(async <T>(action: () => Promise<T>): Promise<T | undefined> => {
    setPending(true)
    setError(null)

    try {
      return await action()
    } catch (actionError) {
      setError(getErrorMessage(actionError))
      return undefined
    } finally {
      setPending(false)
    }
  }, [])

  return { pending, error, run, setError }
}
