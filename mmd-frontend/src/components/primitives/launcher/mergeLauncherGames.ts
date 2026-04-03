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

  // Debug: Check what stories we have
  console.log('Available stories:', data.stories.map(s => ({ id: s.id, title: s.title })))
  console.log('API games count:', data.allGames.length)
  console.log('Sample API game:', data.allGames[0])

  for (const g of data.allGames) {
    const key = `${data.apiBase}:${g.id}`
    const story = g.storyId ? storiesById.get(g.storyId) : undefined
    console.log(`API Game ${g.id}: storyId=${g.storyId}, story=${story?.title}`)
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
    // Prioritize active games (SCHEDULED, PLAYING, REVEAL) over old/done games
    const aIsActive = a.state === 'SCHEDULED' || a.state === 'PLAYING' || a.state === 'REVEAL'
    const bIsActive = b.state === 'SCHEDULED' || b.state === 'PLAYING' || b.state === 'REVEAL'
    
    if (aIsActive !== bIsActive) {
      return aIsActive ? -1 : 1 // Active games first
    }
    
    // For active games, prioritize by scheduled time (newest first)
    if (aIsActive && bIsActive) {
      const aTime = a.scheduledTime ?? ''
      const bTime = b.scheduledTime ?? ''
      if (aTime && bTime) {
        return new Date(bTime).getTime() - new Date(aTime).getTime()
      }
      if (aTime) return -1
      if (bTime) return 1
    }
    
    // For inactive games, prioritize by last seen (newest first)
    const aLastSeen = a.lastSeenAt ?? ''
    const bLastSeen = b.lastSeenAt ?? ''
    if (aLastSeen && bLastSeen) {
      return new Date(bLastSeen).getTime() - new Date(aLastSeen).getTime()
    }
    if (aLastSeen) return -1
    if (bLastSeen) return 1
    
    // Fallback to creation time
    const aCreated = a.scheduledTime ?? ''
    const bCreated = b.scheduledTime ?? ''
    if (aCreated && bCreated) {
      return new Date(bCreated).getTime() - new Date(aCreated).getTime()
    }
    
    // Final fallback to ID comparison
    return b.id.localeCompare(a.id)
  })
}
