import { apiGameSource } from './apiGameSource'
import { localJsonGameSource } from './localJsonGameSource'
import type { GameSource } from './types'

export type GameSourceMode = 'api' | 'local'

export function readGameSourceModeFromLocation(): GameSourceMode {
  const value = new URLSearchParams(window.location.search).get('source')
  return value === 'local' ? 'local' : 'api'
}

export function getGameSource(mode: GameSourceMode): GameSource {
  return mode === 'local' ? localJsonGameSource : apiGameSource
}

