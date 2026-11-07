import type { ReactNode } from 'react'

export function Field({
  label,
  children,
  hint,
  className,
}: {
  label: string
  children: ReactNode
  hint?: string
  className?: string
}) {
  return (
    <label className={className ? `field ${className}` : 'field'}>
      <span>{label}</span>
      {children}
      {hint && <small>{hint}</small>}
    </label>
  )
}

export function FieldRow({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={className ? `field-row ${className}` : 'field-row'}>{children}</div>
}
