import type { PropsWithChildren } from 'react'

export function Surface(props: PropsWithChildren<{ testId?: string }>) {
  return (
    <main className="screen-stack" data-testid={props.testId}>
      {props.children}
    </main>
  )
}

