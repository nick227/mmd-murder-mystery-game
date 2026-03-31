import type { PropsWithChildren } from 'react'

export function Panel(props: PropsWithChildren<{ testId?: string; className?: string }>) {
  return (
    <section className={props.className ? `panel ${props.className}` : 'panel'} data-testid={props.testId}>
      {props.children}
    </section>
  )
}

