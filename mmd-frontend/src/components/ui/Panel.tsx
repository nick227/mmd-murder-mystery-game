import type { PropsWithChildren } from 'react'

export function Panel({ testId, className, dataUi, children }: PropsWithChildren<{ testId?: string; className?: string; dataUi?: string }>) {
  return (
    <section
      className={className ? `panel ${className}` : 'panel'}
      data-testid={testId}
      {...(dataUi ? { 'data-ui': dataUi } : {})}
    >
      {children}
    </section>
  )
}

