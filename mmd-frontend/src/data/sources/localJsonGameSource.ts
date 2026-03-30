import type { HostApiGame, PlayerApiView, StoryListItem } from '../types'
import { adaptGeneratedStoryRunToRuntime } from '../adapters/generatedStoryAdapter'
import { runtimeStoryToHostApiGame, runtimeStoryToPlayerApiView } from '../adapters/runtimeToApi'
import type { GameSource, HostAction } from './types'

type LocalGameRecord = {
  id: string
  storyFile: string
  name: string
  scheduledTime: string
  locationText?: string
  state: 'SCHEDULED' | 'PLAYING' | 'REVEAL' | 'DONE'
  currentAct: number
  playerNamesByCharacterId: Record<string, string>
  solvedActs?: number[]
  revealAnswers?: Array<{ track: 'who' | 'how' | 'why'; answer: string }>
}

function storageKey(gameId: string) {
  return `mmd-local-game:${gameId}`
}

function readStoryFileFromLocation(): string | null {
  return new URLSearchParams(window.location.search).get('story')
}

function readDebugFromLocation(): boolean {
  const value = new URLSearchParams(window.location.search).get('debug')
  return value === '1' || value === 'true'
}

async function fetchLocalStoryFiles(): Promise<string[]> {
  const res = await fetch('/__local_stories')
  if (!res.ok) throw new Error(await res.text())
  const json = (await res.json()) as { files?: unknown }
  return Array.isArray(json.files) ? (json.files as string[]) : []
}

async function fetchLocalStoryJson(filename: string): Promise<unknown> {
  const res = await fetch(`/__local_story/${encodeURIComponent(filename)}`)
  if (!res.ok) throw new Error(await res.text())
  return res.json() as Promise<unknown>
}

function readLocalGame(gameId: string): LocalGameRecord | null {
  const raw = localStorage.getItem(storageKey(gameId))
  if (!raw) return null
  return JSON.parse(raw) as LocalGameRecord
}

function writeLocalGame(record: LocalGameRecord) {
  localStorage.setItem(storageKey(record.id), JSON.stringify(record))
}

function ensureLocalGame(gameId: string, storyFile: string, gameName: string): LocalGameRecord {
  const existing = readLocalGame(gameId)
  if (existing) return existing

  const record: LocalGameRecord = {
    id: gameId,
    storyFile,
    name: gameName,
    scheduledTime: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    state: 'SCHEDULED',
    currentAct: 1,
    playerNamesByCharacterId: {},
  }
  writeLocalGame(record)
  return record
}

async function buildModelsForGame(gameId: string, gameNameFallback: string) {
  const storyFile = readStoryFileFromLocation()
  if (!storyFile) throw new Error('Missing ?story=<filename>.json in local mode.')

  const record = ensureLocalGame(gameId, storyFile, gameNameFallback)
  const storyJson = await fetchLocalStoryJson(record.storyFile)

  const adapted = adaptGeneratedStoryRunToRuntime(storyJson)

  return { record, adapted, storyFile }
}

function resolveCharacterIdFromIndex(story: { playerOrder: string[] }, raw: string): string {
  const value = raw.slice('index:'.length)
  const index = Number(value)
  if (!Number.isInteger(index) || index < 0) {
    throw new Error(`Invalid player index "${value}". Use ?player=0..N`)
  }
  const characterId = story.playerOrder[index]
  if (!characterId) throw new Error(`Player index ${index} is out of range for this story.`)
  return characterId
}

function nextStateAfterHostAction(state: LocalGameRecord['state'], action: HostAction): LocalGameRecord['state'] {
  if (action === 'start') return 'PLAYING'
  if (action === 'done') return 'DONE'
  return state
}

export const localJsonGameSource: GameSource = {
  async fetchStories() {
    const files = await fetchLocalStoryFiles()
    return files.map(file => ({
      id: file,
      title: file.replace(/\.json$/i, ''),
      summary: 'Local generated story file.',
    }))
  },

  async createGame(_apiBase, body) {
    // In local mode, treat storyId as the JSON filename.
    const gameId = `local-${Date.now().toString(36)}`
    const record: LocalGameRecord = {
      id: gameId,
      storyFile: body.storyId,
      name: body.name,
      scheduledTime: body.scheduledTime,
      locationText: body.locationText,
      state: 'SCHEDULED',
      currentAct: 1,
      playerNamesByCharacterId: {},
    }
    writeLocalGame(record)

    // Return a host view derived from the story, but keep it stable with storage.
    const storyJson = await fetchLocalStoryJson(record.storyFile)
    const adapted = adaptGeneratedStoryRunToRuntime(storyJson)
    return runtimeStoryToHostApiGame({
      story: adapted.runtimeStory,
      gameId: record.id,
      gameName: record.name,
      scheduledTime: record.scheduledTime,
      locationText: record.locationText,
      state: record.state,
      currentAct: record.currentAct,
      playerNamesByCharacterId: {},
    })
  },

  async fetchHostGame(_apiBase, gameId) {
    const { record, adapted } = await buildModelsForGame(gameId, 'Local game')
    return runtimeStoryToHostApiGame({
      story: adapted.runtimeStory,
      gameId: record.id,
      gameName: record.name,
      scheduledTime: record.scheduledTime,
      locationText: record.locationText,
      state: record.state,
      currentAct: record.currentAct,
      playerNamesByCharacterId: Object.fromEntries(Object.entries(record.playerNamesByCharacterId).map(([k, v]) => [k, v ?? null])),
    })
  },

  async postHostAction(_apiBase, gameId, _hostKey, action) {
    const storyFile = readStoryFileFromLocation()
    if (!storyFile) throw new Error('Missing ?story=<filename>.json in local mode.')
    const record = ensureLocalGame(gameId, storyFile, 'Local game')

    if (action === 'next-act') {
      record.currentAct = Math.min(99, record.currentAct + 1)
    } else {
      record.state = nextStateAfterHostAction(record.state, action)
    }
    writeLocalGame(record)
    return { ok: true }
  },

  async postEndNight(_apiBase, gameId, _hostKey, body) {
    const storyFile = readStoryFileFromLocation()
    if (!storyFile) throw new Error('Missing ?story=<filename>.json in local mode.')
    const record = ensureLocalGame(gameId, storyFile, 'Local game')
    record.state = 'REVEAL'
    record.revealAnswers = [
      { track: 'who', answer: body.who },
      { track: 'how', answer: body.how },
      { track: 'why', answer: body.why },
    ]
    writeLocalGame(record)
    return { ok: true }
  },

  async joinPlayerByCharacter(_apiBase, gameId, characterId, playerName) {
    const storyFile = readStoryFileFromLocation()
    if (!storyFile) throw new Error('Missing ?story=<filename>.json in local mode.')
    const record = ensureLocalGame(gameId, storyFile, 'Local game')
    const resolvedCharacterId = characterId.startsWith('index:')
      ? resolveCharacterIdFromIndex((await buildModelsForGame(gameId, 'Local game')).adapted.runtimeStory, characterId)
      : characterId
    record.playerNamesByCharacterId[resolvedCharacterId] = playerName
    writeLocalGame(record)
    return { message: 'Joined local game' }
  },

  async submitObjective(_apiBase, gameId, _characterId, objectiveId) {
    // Local mode submission is handled by localStorage event log in useAppState.
    // This exists so the API and local sources share the same interface.
    if (!objectiveId) throw new Error('Missing objectiveId')
    if (!gameId) throw new Error('Missing gameId')
    return { message: 'Submitted objective (local)' }
  },

  async fetchPlayerViewByCharacter(_apiBase, gameId, characterId) {
    const { record, adapted } = await buildModelsForGame(gameId, 'Local game')

    const resolvedCharacterId = characterId.startsWith('index:')
      ? resolveCharacterIdFromIndex(adapted.runtimeStory, characterId)
      : characterId

    const includeDiagnosticsFeed = readDebugFromLocation()
      ? adapted.diagnostics
          .slice(0, 24)
          .map(d => `${d.level.toUpperCase()}: ${d.message}${d.cardType ? ` (type=${d.cardType})` : ''}${d.cardId ? ` (id=${d.cardId})` : ''}`)
      : undefined

    return runtimeStoryToPlayerApiView({
      story: adapted.runtimeStory,
      gameId: record.id,
      gameName: record.name,
      scheduledTime: record.scheduledTime,
      locationText: record.locationText,
      state: record.state,
      currentAct: record.currentAct,
      characterId: resolvedCharacterId,
      playerNamesByCharacterId: Object.fromEntries(Object.entries(record.playerNamesByCharacterId).map(([k, v]) => [k, v ?? null])),
      revealAnswers: record.revealAnswers,
      includeDiagnosticsFeed,
      solvedActs: record.solvedActs ?? [],
    })
  },
}

