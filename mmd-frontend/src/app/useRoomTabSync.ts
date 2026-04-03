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
    if (opts.mode !== 'room') return

    // When the player is not joined, clear any remembered phase so the next join
    // establishes a baseline without triggering a tab jump.
    if (!opts.joined) {
      prev.current = null
      return
    }

    const current = opts.gameState

    // First tick after join: remember the current phase but do not change tabs.
    // Joining should be an in-place state update (presence/name), not navigation.
    if (prev.current === null) {
      prev.current = current
      return
    }

    // Later ticks: if the server phase changes, nudge to the phase-appropriate tab.
    if (prev.current !== current) {
      prev.current = current
      if (opts.targetTab) opts.setActiveTab(opts.targetTab)
    }
  }, [opts.mode, opts.joined, opts.gameState, opts.targetTab, opts.setActiveTab])
}
