import { useEffect, useRef } from 'react'

export type HotkeyHandlers = Record<string, (event: KeyboardEvent) => void>

function esCampoDeTexto(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true

  return ['INPUT', 'SELECT', 'TEXTAREA'].includes(target.tagName)
}

export function useHotkeys(handlers: HotkeyHandlers, enabled = true) {
  const handlersRef = useRef(handlers)
  handlersRef.current = handlers

  useEffect(() => {
    if (!enabled) return

    const handleKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.repeat || event.isComposing) return
      if (event.ctrlKey || event.metaKey || event.altKey) return
      if (esCampoDeTexto(event.target)) return

      const key = event.key.length === 1 ? event.key.toLowerCase() : event.key
      const handler = handlersRef.current[key]

      if (!handler) return

      event.preventDefault()
      handler(event)
    }

    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [enabled])
}
