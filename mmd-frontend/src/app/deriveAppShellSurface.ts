import type { AppShellSurface } from '../utils/uiMarkers'
import type { TabId } from '../data/types'

export function deriveAppShellSurface(
  mode: 'launcher' | 'host' | 'room' | 'play',
  joined: boolean,
  activeTab: TabId,
): AppShellSurface {
  if (mode === 'launcher') return 'launcher'
  if (mode === 'host') return 'host'
  if (!joined) return 'lobby'
  return activeTab
}
