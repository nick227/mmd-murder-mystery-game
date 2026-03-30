import type { RuntimeCard, RuntimeStory } from './runtimeStory.js'

export type GameState = 'SCHEDULED' | 'PLAYING' | 'REVEAL' | 'DONE'

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

export function runtimeStoryToPlayerApiView(input: {
  story: RuntimeStory
  game: {
    id: string
    name: string
    state: GameState
    currentAct: number
    scheduledTime: Date
    locationText: string | null
    players: Array<{ id: string; characterId: string; playerName: string | null; joinedAt: Date | null }>
  }
  me: { id: string; characterId: string; playerName: string | null }
  solvedActs: number[]
  feed: Array<{ id: string; type: string; payload: any; createdAt: Date }>
}) {
  const solved = new Set(input.solvedActs)
  const stage = stageForAct(input.story, input.game.currentAct)

  const unlocked = unlockedCardsForAct(input.story.cards, input.game.currentAct).filter(card => {
    if (card.intent !== 'reveal') return true
    const reveal = card as any
    if (!reveal.hiddenUntilSolved) return true
    return solved.has(card.act)
  })

  const instructionCards = unlocked.filter(c => c.intent === 'instruction')
  const clueCards = unlocked.filter(c => c.intent === 'clue')
  const puzzleCards = unlocked.filter(c => c.intent === 'puzzle')
  const revealCards = unlocked.filter(c => c.intent === 'reveal')

  const unlockedCards = [
    ...instructionCards.map((c, i) => ({ id: c.id ?? `inst-${i}`, text: c.text, act: c.act, type: 'instruction' })),
    ...clueCards.map((c, i) => ({ id: c.id ?? `clue-${i}`, text: c.text, act: c.act, type: 'clue' })),
    ...puzzleCards.map((c, i) => ({ id: c.id ?? `puzzle-${i}`, text: c.text, act: c.act, type: 'puzzle' })),
    ...revealCards.map((c, i) => ({ id: c.id ?? `reveal-${i}`, text: c.text, act: c.act, type: 'reveal' })),
  ]

  const newThisAct = unlocked.filter(c => c.act === input.game.currentAct && (c.intent === 'clue' || c.intent === 'puzzle' || c.intent === 'reveal'))
  const unlockedPuzzles = newThisAct.map((c, index) => ({
    id: c.id ?? `new-${index}`,
    title: c.title ?? (c.intent === 'clue' ? 'Clue' : c.intent === 'puzzle' ? 'Puzzle' : 'Reveal'),
    question: c.text,
    act: c.act,
    intent: c.intent,
  }))

  const me = input.story.playersByCharacterId[input.me.characterId]
  const feed = input.feed.map((e) => ({
    id: e.id,
    type: e.type,
    payload: e.payload,
    createdAt: e.createdAt.toISOString(),
  }))

  return {
    gameId: input.game.id,
    gameName: input.game.name,
    gameState: input.game.state,
    currentAct: input.game.currentAct,
    scheduledTime: input.game.scheduledTime.toISOString(),
    locationText: input.game.locationText,
    stage: stage ? { title: stage.title, text: stage.text, image: stage.image } : null,
    feed,
    roomPlayers: input.game.players.map(p => ({
      id: p.id,
      characterId: p.characterId,
      playerName: p.playerName,
      joinedAt: p.joinedAt ? p.joinedAt.toISOString() : null,
    })),
    playerId: input.me.id,
    characterId: input.me.characterId,
    playerName: input.me.playerName,
    character: me
      ? { id: me.characterId, name: me.name, archetype: me.archetype, biography: me.biography, secrets: me.secrets, items: [] }
      : null,
    unlockedMysteries: [],
    unlockedPuzzles,
    unlockedCards,
  }
}

export function runtimeStoryToHostMeta(input: {
  story: RuntimeStory
  game: {
    id: string
    storyFile: string
    name: string
    hostKey: string
    scheduledTime: Date
    startedAt: Date | null
    state: GameState
    currentAct: number
    locationText: string | null
    createdAt: Date
    updatedAt: Date
    players: Array<{ id: string; characterId: string; playerName: string | null; loginKey: string; joinedAt: Date | null }>
  }
}) {
  const stage = stageForAct(input.story, input.game.currentAct)
  const hostSpeech = unlockedCardsForAct(input.story.cards, input.game.currentAct)
    .filter(c => c.source.cardType === 'host_speech' && c.act === input.game.currentAct)
    .map(c => c.text)
    .join('\n\n')

  const stageText = stage?.text
    ? (hostSpeech ? `${stage.text}\n\nRead this now:\n${hostSpeech}` : stage.text)
    : (hostSpeech ? `Read this now:\n${hostSpeech}` : null)

  const characters = input.story.playersByCharacterId
  return {
    id: input.game.id,
    storyId: input.game.storyFile,
    storyFile: input.game.storyFile,
    name: input.game.name,
    hostKey: input.game.hostKey,
    scheduledTime: input.game.scheduledTime.toISOString(),
    startedAt: input.game.startedAt ? input.game.startedAt.toISOString() : null,
    state: input.game.state,
    currentAct: input.game.currentAct,
    locationText: input.game.locationText,
    createdAt: input.game.createdAt.toISOString(),
    updatedAt: input.game.updatedAt.toISOString(),
    storyTitle: input.story.title,
    stageTitle: stage?.title ?? null,
    stageText,
    stageImage: null,
    players: input.game.players.map(p => ({
      id: p.id,
      characterId: p.characterId,
      characterName: characters[p.characterId]?.name ?? null,
      playerName: p.playerName,
      loginKey: p.loginKey,
      joinedAt: p.joinedAt ? p.joinedAt.toISOString() : null,
    })),
  }
}

