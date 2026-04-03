import type { StoredGameLink } from './types'

const STORAGE_KEY = 'mmd:links:v1'

function nowIso() {
  return new Date().toISOString()
}

function asStringArray(input: unknown): string[] {
  if (!Array.isArray(input)) return []
  return input.map(String).filter(Boolean)
}

function parseStored(input: unknown): StoredGameLink[] {
  if (!Array.isArray(input)) return []
  return input
    .map(item => (item && typeof item === 'object' ? item as Record<string, unknown> : null))
    .filter(Boolean)
    .map(item => {
      const gameId = typeof item!.gameId === 'string' ? item!.gameId : ''
      // apiBase may legitimately be '' (same-origin API). Treat missing/non-string as ''.
      const apiBase = typeof item!.apiBase === 'string' ? item!.apiBase : ''
      const hostKey = typeof item!.hostKey === 'string' ? item!.hostKey : undefined
      const storyRaw = item!.story && typeof item!.story === 'object' ? (item!.story as Record<string, unknown>) : null
      const story = storyRaw
        ? {
            id: typeof storyRaw.id === 'string' || storyRaw.id === null ? (storyRaw.id as string | null) : undefined,
            title: typeof storyRaw.title === 'string' ? storyRaw.title : undefined,
            summary: typeof storyRaw.summary === 'string' ? storyRaw.summary : undefined,
            image: typeof storyRaw.image === 'string' ? storyRaw.image : undefined,
          }
        : undefined
      const characterIds = asStringArray(item!.characterIds)
      const lastSeenAt = typeof item!.lastSeenAt === 'string' ? item!.lastSeenAt : nowIso()
      return { gameId, apiBase, hostKey, characterIds, story, lastSeenAt }
    })
    // apiBase can be '' (same-origin). Only require gameId.
    .filter(item => Boolean(item.gameId))
}

export function readStoredGames(): StoredGameLink[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    const parsed = raw ? JSON.parse(raw) : []
    return parseStored(parsed).sort((a, b) => b.lastSeenAt.localeCompare(a.lastSeenAt))
  } catch {
    return []
  }
}

function writeStoredGames(next: StoredGameLink[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next))
  } catch {
    // ignore
  }
}

function upsert(input: {
  gameId: string
  apiBase: string
  hostKey?: string
  characterId?: string
  characterIds?: string[]
  story?: StoredGameLink['story']
}) {
  const current = readStoredGames()
  const idx = current.findIndex(x => x.gameId === input.gameId && x.apiBase === input.apiBase)
  const base: StoredGameLink =
    idx >= 0
      ? current[idx]
      : { gameId: input.gameId, apiBase: input.apiBase, characterIds: [], lastSeenAt: nowIso() }

  const nextCharacterIds = new Set<string>(base.characterIds)
  if (input.characterId) nextCharacterIds.add(input.characterId)
  for (const id of input.characterIds ?? []) nextCharacterIds.add(id)

  const next: StoredGameLink = {
    ...base,
    hostKey: input.hostKey ?? base.hostKey,
    characterIds: Array.from(nextCharacterIds),
    story: input.story ?? base.story,
    lastSeenAt: nowIso(),
  }

  const out =
    idx >= 0
      ? [...current.slice(0, idx), next, ...current.slice(idx + 1)]
      : [next, ...current]

  writeStoredGames(out)
}

export function upsertHostLink(input: { gameId: string; apiBase: string; hostKey: string }) {
  upsert(input)
}

export function upsertPlayerLink(input: { gameId: string; apiBase: string; characterId: string }) {
  upsert(input)
}

export function upsertCreatedGame(input: {
  gameId: string
  apiBase: string
  hostKey: string
  characterIds: string[]
  story?: StoredGameLink['story']
}) {
  upsert(input)
}

export function upsertGameStory(input: { gameId: string; apiBase: string; story: StoredGameLink['story'] }) {
  const current = readStoredGames()
  const idx = current.findIndex(x => x.gameId === input.gameId && x.apiBase === input.apiBase)
  if (idx < 0) return
  const existing = current[idx]
  if (existing.story && (existing.story.id || existing.story.title || existing.story.image || existing.story.summary)) return
  const next: StoredGameLink = { ...existing, story: input.story }
  writeStoredGames([...current.slice(0, idx), next, ...current.slice(idx + 1)])
}

