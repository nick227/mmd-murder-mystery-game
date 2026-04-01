import { useEffect, useRef } from 'react'
import type { GameState, TabId, ViewMode } from '../data/types'

/**
 * When the server game phase changes, nudge the room tab (e.g. SCHEDULED → lobby, live → game).
 */
export function useRoomTabSync(opts: {
  mode: ViewMode
  joined: boolean
  gameState: GameState
  targetTab: TabId | null
  setActiveTab: (tab: TabId) => void
}) {
  const prev = useRef<string | null>(null)
  useEffect(() => {
    if (opts.mode !== 'room' || !opts.joined) return
    const current = opts.gameState
    if (prev.current !== current) {
      prev.current = current
      if (opts.targetTab) opts.setActiveTab(opts.targetTab)
    }
  }, [opts.mode, opts.joined, opts.gameState, opts.targetTab, opts.setActiveTab])
}
