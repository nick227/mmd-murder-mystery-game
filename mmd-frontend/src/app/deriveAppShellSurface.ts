import type { AppShellSurface } from '../utils/uiMarkers'

export function deriveAppShellSurface(
  mode: 'launcher' | 'host' | 'room',
  joined: boolean,
  activeTab: 'lobby' | 'game' | 'profile',
): AppShellSurface {
  if (mode === 'launcher') return 'launcher'
  if (mode === 'host') return 'host'
  if (!joined) return 'lobby'
  return activeTab
}
