import type { ApiGameEvent, GameState, HostApiGame, HostApiGamePlayer, PlayerApiView } from '../types'
import type { RuntimeCard, RuntimeStory } from '../runtime/types'

function stableLocalId(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `local-${(hash >>> 0).toString(16)}`
}

function stageForAct(story: RuntimeStory, currentAct: number) {
  return story.stageByAct[currentAct] ?? null
}

function unlockedCardsForAct(cards: RuntimeCard[], currentAct: number) {
  return cards.filter(c => c.act <= currentAct)
}

export function runtimeStoryToHostApiGame(input: {
  story: RuntimeStory
  gameId: string
  gameName: string
  scheduledTime: string
  locationText?: string
  state: GameState
  currentAct: number
  playerNamesByCharacterId: Record<string, string | null>
}): HostApiGame {
  const players: HostApiGamePlayer[] = input.story.playerOrder
    .map(characterId => input.story.playersByCharacterId[characterId])
    .filter(Boolean)
    .map(p => {
      const playerName = input.playerNamesByCharacterId[p.characterId] ?? null
      return {
        id: `p-${p.characterId}`,
        characterId: p.characterId,
        characterName: p.name,
        playerName,
        loginKey: `local-${p.characterId}`,
        joinedAt: playerName ? new Date().toISOString() : null,
      }
    })

  const stage = stageForAct(input.story, input.currentAct)
  const hostSpeech = unlockedCardsForAct(input.story.cards, input.currentAct)
    .filter(c => c.source.cardType === 'host_speech' && c.act === input.currentAct)
    .map(c => c.text)
    .join('\n\n')
  const stageText = stage?.text
    ? (hostSpeech ? `${stage.text}\n\nRead this now:\n${hostSpeech}` : stage.text)
    : (hostSpeech ? `Read this now:\n${hostSpeech}` : null)

  return {
    id: input.gameId,
    storyId: input.story.id,
    name: input.gameName,
    storyTitle: input.story.title,
    hostKey: 'local',
    scheduledTime: input.scheduledTime,
    startedAt: input.state === 'SCHEDULED' ? null : new Date().toISOString(),
    state: input.state,
    currentAct: input.currentAct,
    locationText: input.locationText ?? null,
    stageTitle: stage?.title ?? null,
    stageText,
    stageImage: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    players,
  }
}

export function runtimeStoryToPlayerApiView(input: {
  story: RuntimeStory
  gameId: string
  gameName: string
  scheduledTime: string
  locationText?: string
  state: GameState
  currentAct: number
  characterId: string
  playerNamesByCharacterId: Record<string, string | null>
  revealAnswers?: Array<{ track: 'who' | 'how' | 'why'; answer: string }>
  includeDiagnosticsFeed?: string[]
  solvedActs?: number[]
}): PlayerApiView {
  const stage = stageForAct(input.story, input.currentAct)

  const playerSlots = input.story.playerOrder
    .map(characterId => input.story.playersByCharacterId[characterId])
    .filter(Boolean)
    .map(p => {
      const name = input.playerNamesByCharacterId[p.characterId] ?? null
      return {
        id: `p-${p.characterId}`,
        characterId: p.characterId,
        playerName: name,
        joinedAt: name ? new Date().toISOString() : null,
      }
    })

  const me = input.story.playersByCharacterId[input.characterId]
  const playerName = input.playerNamesByCharacterId[input.characterId] ?? null

  const solved = new Set(input.solvedActs ?? [])
  const unlocked = unlockedCardsForAct(input.story.cards, input.currentAct).filter(card => {
    if (card.intent !== 'reveal') return true
    const reveal = card as RuntimeCard & { intent: 'reveal'; hiddenUntilSolved?: boolean }
    if (!reveal.hiddenUntilSolved) return true
    return solved.has(card.act)
  })
  const hostSpeechEvents: ApiGameEvent[] = unlocked
    .filter(c => c.source.cardType === 'host_speech')
    .map((c, index) => ({
      id: c.id || `host-${index}`,
      type: 'ANNOUNCEMENT',
      payload: { message: c.text },
      createdAt: new Date().toISOString(),
    }))

  const diagnosticsEvents: ApiGameEvent[] = (input.includeDiagnosticsFeed ?? []).length
    ? [{
        id: stableLocalId(`diag:${input.gameId}:${input.characterId}`),
        type: 'SYSTEM',
        payload: { message: `Adapter diagnostics:\n${(input.includeDiagnosticsFeed ?? []).join('\n')}` },
        createdAt: new Date().toISOString(),
      }]
    : []

  const instructionCards = unlocked.filter(c => c.intent === 'instruction')
  const clueCards = unlocked.filter(c => c.intent === 'clue')
  const puzzleCards = unlocked.filter(c => c.intent === 'puzzle')
  const revealCards = unlocked.filter(c => c.intent === 'reveal')
  const infoCards = unlocked.filter(c => c.intent === 'info')
  const hostSpeechCards = infoCards.filter(c => c.source.cardType === 'host_speech')
  const treasureCards = infoCards.filter(c => c.source.cardType === 'treasure')

  const visibleInfoCards = infoCards
    .filter(c => c.source.cardType !== 'host_speech' && c.source.cardType !== 'treasure' && c.source.cardType !== 'secret' && c.source.cardType !== 'item')
    .map((c, index) => ({ id: c.id ?? `info-${index}`, act: c.act, title: c.title ?? null, text: c.text, cardType: c.source.cardType }))

  const visibleHostSpeech = hostSpeechCards.map((c, index) => ({ id: c.id ?? `host-${index}`, act: c.act, title: c.title ?? null, text: c.text }))
  const visibleTreasures = treasureCards.map((c, index) => ({ id: c.id ?? `treasure-${index}`, act: c.act, title: c.title ?? null, text: c.text }))

  const unlockedCards = [
    ...instructionCards.map((c, i) => ({ id: c.id ?? `inst-${i}`, text: c.text, act: c.act, type: 'instruction' })),
    ...clueCards.map((c, i) => ({ id: c.id ?? `clue-${i}`, text: c.text, act: c.act, type: 'clue' })),
    ...puzzleCards.map((c, i) => ({ id: c.id ?? `puzzle-${i}`, text: c.text, act: c.act, type: 'puzzle' })),
    ...revealCards.map((c, i) => ({ id: c.id ?? `reveal-${i}`, text: c.text, act: c.act, type: 'reveal' })),
  ]

  const newThisAct = unlocked.filter(c => c.act === input.currentAct && (c.intent === 'clue' || c.intent === 'puzzle' || c.intent === 'reveal'))
  const unlockedPuzzles = newThisAct.map((c, index) => ({
    id: c.id ?? `new-${index}`,
    title: c.title ?? (c.intent === 'clue' ? 'Clue' : c.intent === 'puzzle' ? 'Puzzle' : 'Reveal'),
    question: c.text,
    act: c.act,
    intent: c.intent,
  }))

  return {
    gameId: input.gameId,
    gameName: input.gameName,
    gameState: input.state,
    currentAct: input.currentAct,
    scheduledTime: input.scheduledTime,
    locationText: input.locationText ?? null,
    stage: stage ? { title: stage.title, text: stage.text, image: stage.image } : null,
    feed: [...diagnosticsEvents, ...hostSpeechEvents],
    roomPlayers: playerSlots,
    playerId: `p-${input.characterId}`,
    characterId: input.characterId,
    playerName,
    character: me
      ? { id: me.characterId, name: me.name, archetype: me.archetype, biography: me.biography, secrets: me.secrets, items: [] }
      : null,
    visibleInfoCards,
    visibleItems: [],
    visibleHostSpeech,
    visibleTreasures,
    unlockedMysteries: [],
    unlockedPuzzles,
    unlockedCards,
    mysteryAnswers: input.state === 'REVEAL' ? (input.revealAnswers ?? []) : undefined,
  }
}
