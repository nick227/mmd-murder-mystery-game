import type { PageSchema, ViewMode } from '../data/types'
import { hostPageSchema, launcherPageSchema, playerPageSchema } from './pages'

/** Schema driving `PageRenderer` for launcher / host / room (room layouts are mostly empty; see `pages.ts`). */
export function selectPageSchema(mode: ViewMode): PageSchema {
  if (mode === 'host') return hostPageSchema
  if (mode === 'room') return playerPageSchema
  return launcherPageSchema
}
