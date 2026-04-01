import type { ReactNode } from 'react'

export function Card({
  title,
  meta,
  children,
  className,
}: {
  title?: string
  meta?: string
  children: ReactNode
  /** Semantic surface hook at call site, e.g. `join-card`, `profile-card`. */
  className?: string
}) {
  return (
    <section className={['panel', className].filter(Boolean).join(' ')}>
      {title || meta ? (
        <div className="panel__header">
          {title ? <h2>{title}</h2> : null}
          {meta ? <div className="panel__meta">{meta}</div> : null}
        </div>
      ) : null}
      {children}
    </section>
  )
}
