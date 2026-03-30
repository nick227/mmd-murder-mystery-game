import { apiGameSource } from './apiGameSource'
import type { GameSource } from './types'

export type GameSourceMode = 'api'

export function readGameSourceModeFromLocation(): GameSourceMode {
  return 'api'
}

export function getGameSource(_mode: GameSourceMode): GameSource {
  return apiGameSource
}

