import type { GameState, LauncherData } from '../../../data/types'

export type MergedGameRow = {
  id: string
  apiBase: string
  name?: string
  creatorUserId?: string | null
  creatorName?: string | null
  creatorAvatar?: string | null
  storyId?: string | null
  storyTitle?: string
  storyImage?: string
  storySummary?: string
  state?: GameState
  scheduledTime?: string
  locationText?: string | null
  lastSeenAt?: string
  access?: { hostKey?: string; characterIds: string[] }
}

export function mergeLauncherGames(data: LauncherData): MergedGameRow[] {
  const gamesByKey = new Map<string, MergedGameRow>()
  const storiesById = new Map(data.stories.map(story => [story.id, { title: story.title, summary: story.summary, image: story.image }] as const))

  for (const g of data.allGames) {
    const key = `${data.apiBase}:${g.id}`
    const story = g.storyId ? storiesById.get(g.storyId) : undefined
    gamesByKey.set(key, {
      id: g.id,
      apiBase: data.apiBase,
      name: g.name,
      creatorUserId: g.creatorUserId,
      creatorName: g.creatorName,
      creatorAvatar: g.creatorAvatar,
      storyId: g.storyId,
      storyTitle: story?.title,
      storySummary: story?.summary,
      storyImage: story?.image,
      state: g.state,
      scheduledTime: g.scheduledTime,
      locationText: g.locationText,
      access: { characterIds: [] },
    })
  }

  for (const saved of data.savedGames) {
    const key = `${saved.apiBase}:${saved.gameId}`
    const existing = gamesByKey.get(key)
    const storyId = existing?.storyId ?? saved.story?.id ?? null
    const storyFromList = storyId ? storiesById.get(storyId) : undefined
    gamesByKey.set(key, {
      id: saved.gameId,
      apiBase: saved.apiBase,
      name: existing?.name,
      creatorUserId: existing?.creatorUserId,
      creatorName: existing?.creatorName,
      creatorAvatar: existing?.creatorAvatar,
      storyId,
      storyTitle: existing?.storyTitle ?? saved.story?.title ?? storyFromList?.title,
      storySummary: existing?.storySummary ?? saved.story?.summary ?? storyFromList?.summary,
      storyImage: existing?.storyImage ?? saved.story?.image ?? storyFromList?.image,
      state: existing?.state,
      scheduledTime: existing?.scheduledTime,
      locationText: existing?.locationText,
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
