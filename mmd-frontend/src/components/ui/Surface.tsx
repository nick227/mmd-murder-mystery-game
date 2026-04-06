import type { PropsWithChildren } from 'react'
import type { SurfaceId } from '../../utils/uiMarkers'
import { ui } from '../../utils/uiMarkers'

export type { SurfaceId } from '../../utils/uiMarkers'

type SurfaceUi = 'LobbySurface' | 'ProfileSurface'

export function Surface(props: PropsWithChildren<{
  testId?: string
  surface: SurfaceId
  /** Must match this file name as exported: LobbySurface | ProfileSurface */
  dataUi: SurfaceUi
}>) {
  return (
    <main
      className={`screen-stack surface surface--${props.surface}`}
      data-testid={props.testId}
      {...ui(props.dataUi)}
    >
      {props.children}
    </main>
  )
}
