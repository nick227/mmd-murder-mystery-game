import type { AppShellSurface } from '../utils/uiMarkers'
import type { TabId } from '../data/types'

/** Tab `feed` maps to shell surface `lobby` (room activity); CSS/tokens unchanged until a later pass. */
export function deriveAppShellSurface(
  mode: 'launcher' | 'host' | 'room' | 'play',
  joined: boolean,
  activeTab: TabId,
): AppShellSurface {
  if (mode === 'launcher') return 'launcher'
  if (mode === 'host') return 'host'
  if (!joined) return 'lobby'
  if (activeTab === 'feed') return 'lobby'
  return activeTab
}
