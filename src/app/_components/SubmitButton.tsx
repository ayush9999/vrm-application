'use client'

import { useFormStatus } from 'react-dom'
import { Spinner } from './Spinner'

interface SubmitButtonProps {
  label: string
  pendingLabel?: string
  className?: string
  style?: React.CSSProperties
  spinnerSize?: number
}

/**
 * A submit button that automatically shows a spinner while the parent form is pending.
 * Must be rendered inside a <form> element.
 */
export function SubmitButton({
  label,
  pendingLabel,
  className = '',
  style,
  spinnerSize = 14,
}: SubmitButtonProps) {
  const { pending } = useFormStatus()
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center gap-2 disabled:opacity-50 ${className}`}
      style={style}
    >
      {pending && <Spinner size={spinnerSize} />}
      {pending ? (pendingLabel ?? `${label}…`) : label}
    </button>
  )
}
