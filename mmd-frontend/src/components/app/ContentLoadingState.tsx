import { useId } from 'react'

export interface ContentLoadingStateProps {
  label?: string
  className?: string
}

/** Content-column loading (not full screen); use below sticky header. */
export function ContentLoadingState({ label = 'Loading…', className }: ContentLoadingStateProps) {
  const labelId = useId()
  return (
    <div
      className={`content-loading${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-labelledby={labelId}
    >
      <div className="content-loading__spinner" aria-hidden />
      <p id={labelId} className="content-loading__label">
        {label}
      </p>
    </div>
  )
}
