/**
 * Single source of truth for vertical order in the player lobby.
 * Reorder by moving ids in this array only — `renderLobbySection` in `lobbySectionLayout.tsx` stays in sync by id.
 */
export const LOBBY_SECTION_ORDER = [
  'meta',
  'join',
  'room',
  'host',
  'status',
  'story',
  'profile',
  'act',
  'players',
  'evidence',
  'composer',
  'feed',
] as const

export type LobbySectionId = (typeof LOBBY_SECTION_ORDER)[number]
