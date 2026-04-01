import type { GameState, LauncherData } from '../../../data/types'

export type MergedGameRow = {
  id: string
  apiBase: string
  name?: string
  state?: GameState
  scheduledTime?: string
  lastSeenAt?: string
  access?: { hostKey?: string; characterIds: string[] }
}

export function mergeLauncherGames(data: LauncherData): MergedGameRow[] {
  const gamesByKey = new Map<string, MergedGameRow>()

  for (const g of data.allGames) {
    const key = `${data.apiBase}:${g.id}`
    gamesByKey.set(key, {
      id: g.id,
      apiBase: data.apiBase,
      name: g.name,
      state: g.state,
      scheduledTime: g.scheduledTime,
      access: { characterIds: [] },
    })
  }

  for (const saved of data.savedGames) {
    const key = `${saved.apiBase}:${saved.gameId}`
    const existing = gamesByKey.get(key)
    gamesByKey.set(key, {
      id: saved.gameId,
      apiBase: saved.apiBase,
      name: existing?.name,
      state: existing?.state,
      scheduledTime: existing?.scheduledTime,
      lastSeenAt: saved.lastSeenAt,
      access: {
        hostKey: saved.hostKey,
        characterIds: saved.characterIds,
      },
    })
  }

  return Array.from(gamesByKey.values()).sort((a, b) => {
    const aKey = a.lastSeenAt ?? a.scheduledTime ?? ''
    const bKey = b.lastSeenAt ?? b.scheduledTime ?? ''
    return bKey.localeCompare(aKey) || a.id.localeCompare(b.id)
  })
}
