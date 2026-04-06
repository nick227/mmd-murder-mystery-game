import type { AppShellSurface } from '../utils/uiMarkers'
import type { TabId } from '../data/types'

/** Room/play are always lobby shell; host vs launcher unchanged. Tab ids only affect non-room flows. */
export function deriveAppShellSurface(
  mode: 'launcher' | 'host' | 'room' | 'play',
  _joined: boolean,
  _activeTab: TabId,
): AppShellSurface {
  if (mode === 'launcher') return 'launcher'
  if (mode === 'host') return 'host'
  return 'lobby'
}
