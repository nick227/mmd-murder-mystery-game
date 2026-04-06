import type { RuntimeCard, RuntimeStory } from './runtimeStory.js'
import { runtimeVisibilityDebug } from './runtimeVisibilityDebug.js'

export type GameState = 'SCHEDULED' | 'PLAYING' | 'REVEAL' | 'DONE' | 'CANCELLED'

function stageForAct(story: RuntimeStory, currentAct: number) {
  return story.stageByAct[currentAct] ?? null
}

function unlockedCardsForAct(cards: RuntimeCard[], currentAct: number) {
  return cards.filter(c => c.act <= currentAct)
}

function maxActForStory(story: RuntimeStory): number {
  let maxAct = 1
  for (const key of Object.keys(story.stageByAct ?? {})) {
    const n = Number(key)
    if (Number.isInteger(n) && n > maxAct) maxAct = n
  }
  for (const card of story.cards) {
    if (typeof card.act === 'number' && Number.isFinite(card.act) && card.act > maxAct) maxAct = card.act
  }
  return maxAct
}

function stableIndex(input: string, mod: number): number {
  if (mod <= 0) return 0
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0) % mod
}

export function runtimeStoryToPlayerApiView(input: {
  story: RuntimeStory
  storyImage?: string | null
  game: {
    id: string
    name: string
    creatorName?: string | null
    state: GameState
    currentAct: number
    scheduledTime: Date
    locationText: string | null
    mysteryAnswers?: Array<{ track: 'who' | 'how' | 'why'; answer: string }> | null
    players: Array<{ id: string; characterId: string; playerName: string | null; joinedAt: Date | null }>
  }
  me: { id: string; characterId: string; playerName: string | null }
  solvedActs: number[]
  feed: Array<{ id: string; type: string; payload: any; createdAt: Date }>
}) {
  const solved = new Set(input.solvedActs)
  const maxAct = maxActForStory(input.story)
  const isScheduled = input.game.state === 'SCHEDULED'
  const isPlaying = input.game.state === 'PLAYING'
  const isReveal = input.game.state === 'REVEAL'
  const isDone = input.game.state === 'DONE'

  const stageAct =
    isScheduled ? 1
    : isReveal || isDone ? maxAct
    : input.game.currentAct

  const stage = stageForAct(input.story, stageAct)

  const playerCount = input.story.playerOrder.length
  const myIndex = input.story.playerOrder.indexOf(input.me.characterId)

  const visibleToMe = (card: RuntimeCard): boolean => {
    const any = card as any

    // Tier 1: NEW canonical linking by character name (Surf's Up+ schema).
    if (typeof any.linked_character === 'string' && any.linked_character) {
      const myCharName = input.story.playersByCharacterId[input.me.characterId]?.name
      return any.linked_character === myCharName
    }

    // Tier 2: Legacy explicit ID linking (older explicit-id schema).
    const target = any.targetCharacterId as string | null | undefined
    if (typeof target === 'string' && input.story.playersByCharacterId[target]) {
      return target === input.me.characterId
    }

    // Instructions + clues are safe to share by default (keeps playability even when
    // stories lack explicit linking fields and we inject fallbacks).
    if (card.intent === 'instruction') return true
    if (card.intent === 'clue') return true

    // Tier 3: Legacy hash fallback (Jekyll-era, no linking fields at all).
    const ownerIndex = stableIndex(card.id, playerCount)
    return ownerIndex === (myIndex >= 0 ? myIndex : 0)
  }

  const actLimit =
    isDone ? Number.POSITIVE_INFINITY
    : isScheduled ? 0
    : input.game.currentAct

  const unlockedByAct = (card: RuntimeCard): boolean =>
    isDone ? true
    : card.act <= actLimit

  const isCardType = (card: RuntimeCard, type: string): boolean =>
    String(card.source?.cardType ?? '') === type

  const hostSpeechCards = input.story.cards.filter(c => isCardType(c, 'host_speech'))
  const visibleHostSpeechCards =
    isDone
      ? hostSpeechCards
      : isScheduled
      ? hostSpeechCards.filter(c => c.act === 1)
      : isPlaying
      ? hostSpeechCards.filter(c => c.act === input.game.currentAct)
      : isReveal
      ? hostSpeechCards.filter(c => c.act === maxAct)
      : []

  const playableCards =
    isScheduled
      ? []
      : input.story.cards.filter(unlockedByAct)

  const visibleInstructions = playableCards.filter(c => c.intent === 'instruction' && (isDone ? true : visibleToMe(c)))
  const visibleClues = playableCards.filter(c => c.intent === 'clue' && (isDone ? true : visibleToMe(c)))
  const visiblePuzzles = playableCards.filter(c => c.intent === 'puzzle')

  const visibleReveals = (() => {
    if (isScheduled) return [] as RuntimeCard[]
    if (isDone) return input.story.cards.filter(c => c.intent === 'reveal')
    if (isReveal) return input.story.cards.filter(c => c.intent === 'reveal')

    return playableCards.filter(card => {
      if (card.intent !== 'reveal') return false
      return solved.has(card.act)
    })
  })()

  const visibleInfoCards = (() => {
    const pregameActLimit = 1
    const infoActLimit = isDone ? Number.POSITIVE_INFINITY : isScheduled ? pregameActLimit : actLimit
    return input.story.cards.filter(card => {
      if (card.intent !== 'info') return false
      if (!isDone && card.act > infoActLimit) return false
      if (isCardType(card, 'host_speech')) return false
      if (isCardType(card, 'secret')) return false
      if (isCardType(card, 'item')) return false
      if (isCardType(card, 'treasure')) return false
      return true
    })
  })()

  const visibleTreasures = (() => {
    if (isScheduled) return [] as RuntimeCard[]
    return input.story.cards.filter(card => {
      if (!isCardType(card, 'treasure')) return false
      return unlockedByAct(card)
    })
  })()

  const me = input.story.playersByCharacterId[input.me.characterId]

  const visibleInventoryItems = (() => {
    const pregameActLimit = 1
    const itemActLimit = isDone ? Number.POSITIVE_INFINITY : isScheduled ? pregameActLimit : actLimit
    const items = me?.items ?? []
    return items.filter(item => typeof item.act === 'number' && item.act <= itemActLimit)
  })()

  const visibleItemCardItems = (() => {
    const pregameActLimit = 1
    const itemActLimit = isDone ? Number.POSITIVE_INFINITY : isScheduled ? pregameActLimit : actLimit
    const myName = me?.name ?? null

    return input.story.cards
      .filter(card => isCardType(card, 'item'))
      .filter(card => {
        if (!isDone && card.act > itemActLimit) return false
        const linked = typeof (card as any).linked_character === 'string' ? String((card as any).linked_character) : null
        // Unlinked item cards are treated as "global" items (visible to all).
        if (!linked) return true
        return Boolean(myName && linked === myName)
      })
      .map((card, index) => ({
        id: card.id ?? `item-card-${index}`,
        name: card.title ?? 'Item',
        description: card.text ?? '',
        act: card.act,
        locationRef: null,
      }))
  })()

  const visibleItems = (() => {
    const byId = new Map<string, (typeof visibleInventoryItems)[number]>()
    for (const item of [...visibleInventoryItems, ...visibleItemCardItems]) {
      byId.set(item.id, item)
    }
    return Array.from(byId.values()).sort((a, b) => a.act - b.act || a.name.localeCompare(b.name))
  })()

  const unlockedCards = [
    ...visibleInstructions.map((c, i) => ({ id: c.id ?? `inst-${i}`, text: c.text, act: c.act, type: 'instruction' })),
    ...visibleClues.map((c, i) => ({ id: c.id ?? `clue-${i}`, text: c.text, act: c.act, type: 'clue', suspectName: (c as any).suspectName ?? null })),
    ...visibleReveals.map((c, i) => ({ id: c.id ?? `reveal-${i}`, text: c.text, act: c.act, type: 'reveal' })),
  ]

  const unlockedPuzzles = visiblePuzzles.map((c, index) => ({
    id: c.id ?? `puzzle-${index}`,
    title: c.title ?? 'Puzzle',
    question: c.text,
    act: c.act,
    intent: 'puzzle',
  }))

  const actStartByAct = new Map<number, Date>()
  for (const e of input.feed) {
    if (e.type === 'START_GAME') actStartByAct.set(1, e.createdAt)
    if (e.type === 'ADVANCE_ACT') {
      const act = typeof e.payload?.act === 'number' ? e.payload.act : null
      if (act) actStartByAct.set(act, e.createdAt)
    }
  }

  const baseFeed = input.feed.map((e) => ({
    id: e.id,
    type: e.type,
    payload: e.payload,
    createdAt: e.createdAt.toISOString(),
  }))

  const hostSpeechFeed = visibleHostSpeechCards.map((c, index) => ({
    id: `host-speech:${c.id ?? `host-${index}`}`,
    type: 'ANNOUNCEMENT',
    payload: { message: c.text, cardType: 'host_speech', cardId: c.id ?? null, act: c.act },
    createdAt: (actStartByAct.get(c.act) ?? input.game.scheduledTime ?? new Date()).toISOString(),
  }))

  const treasureFeed = visibleTreasures.map((c, index) => ({
    id: `treasure:${c.id ?? `treasure-${index}`}`,
    type: 'ANNOUNCEMENT',
    payload: {
      message: `${c.title ? `${c.title}\n` : ''}${c.text}`,
      cardType: 'treasure',
      cardId: c.id ?? null,
      act: c.act,
    },
    createdAt: (actStartByAct.get(c.act) ?? input.game.scheduledTime ?? new Date()).toISOString(),
  }))

  const stageText = stage?.text
    ? (visibleHostSpeechCards.length
        ? `${stage.text}\n\nRead this now:\n${visibleHostSpeechCards.map(c => c.text).join('\n\n')}`
        : stage.text)
    : (visibleHostSpeechCards.length ? `Read this now:\n${visibleHostSpeechCards.map(c => c.text).join('\n\n')}` : null)

  runtimeVisibilityDebug({
    gameId: input.game.id,
    state: input.game.state,
    currentAct: input.game.currentAct,
    solvedActs: input.solvedActs,
    storyCards: input.story.cards,
    bundles: input.story.bundles,
    visibleClues,
    visiblePuzzles,
    visibleReveals: visibleReveals as any,
    visibleHostSpeech: visibleHostSpeechCards,
    visibleTreasures,
    visibleInfoCards,
    visibleItems,
    returnedSecretsCount: (isScheduled || isDone) ? (me?.secrets?.length ?? 0) : 0,
  })

  return {
    gameId: input.game.id,
    gameName: input.game.name,
    creatorName: input.game.creatorName ?? null,
    storyTitle: input.story.title,
    storyBlurb: input.story.summary,
    gameState: input.game.state,
    currentAct: input.game.currentAct,
    scheduledTime: input.game.scheduledTime.toISOString(),
    locationText: input.game.locationText,
    storyImage: input.storyImage ?? null,
    stage: stage ? { title: stage.title, text: stageText ?? stage.text, image: stage.image } : null,
    feed: [...baseFeed, ...hostSpeechFeed, ...treasureFeed].sort((a, b) => a.createdAt.localeCompare(b.createdAt)),
    roomPlayers: input.game.players.map(p => ({
      id: p.id,
      characterId: p.characterId,
      characterName: input.story.playersByCharacterId[p.characterId]?.name ?? null,
      portrait: input.story.playersByCharacterId[p.characterId]?.image ?? null,
      playerName: p.playerName,
      joinedAt: p.joinedAt ? p.joinedAt.toISOString() : null,
    })),
    playerId: input.me.id,
    characterId: input.me.characterId,
    playerName: input.me.playerName,
    character: me
      ? {
          id: me.characterId,
          name: me.name,
          archetype: me.archetype,
          biography: me.biography,
          image: me.image ?? null,
          secrets: isScheduled || isDone ? me.secrets : [],
          items: visibleInventoryItems.map(item => item.name),
        }
      : null,
    visibleInfoCards: visibleInfoCards.map((c, index) => ({
      id: c.id ?? `info-${index}`,
      act: c.act,
      title: c.title ?? null,
      text: c.text,
      cardType: String(c.source?.cardType ?? 'info'),
    })),
    visibleItems: visibleItems.map((item, index) => ({
      id: item.id ?? `item-${index}`,
      act: item.act,
      name: item.name,
      description: item.description,
      locationRef: item.locationRef ?? null,
    })),
    visibleHostSpeech: visibleHostSpeechCards.map((c, index) => ({
      id: c.id ?? `host-${index}`,
      act: c.act,
      title: c.title ?? null,
      text: c.text,
    })),
    visibleTreasures: visibleTreasures.map((c, index) => ({
      id: c.id ?? `treasure-${index}`,
      act: c.act,
      title: c.title ?? null,
      text: c.text,
    })),
    unlockedMysteries: [],
    unlockedPuzzles,
    unlockedCards,
    mysteryAnswers:
      (isReveal || isDone) && Array.isArray(input.game.mysteryAnswers) && input.game.mysteryAnswers.length
        ? input.game.mysteryAnswers.map(a => ({ track: a.track, answer: a.answer }))
        : undefined,
  }
}

export function runtimeStoryToHostMeta(input: {
  story: RuntimeStory
  game: {
    id: string
    storyFile: string
    name: string
    ownerUserId?: string | null
    creatorName?: string | null
    creatorAvatar?: string | null
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
    creatorUserId: input.game.ownerUserId ?? null,
    creatorName: input.game.creatorName ?? null,
    creatorAvatar: input.game.creatorAvatar ?? null,
    hostKey: input.game.hostKey,
    scheduledTime: input.game.scheduledTime.toISOString(),
    startedAt: input.game.startedAt ? input.game.startedAt.toISOString() : null,
    state: input.game.state,
    currentAct: input.game.currentAct,
    maxAct: maxActForStory(input.story),
    locationText: input.game.locationText,
    createdAt: input.game.createdAt.toISOString(),
    updatedAt: input.game.updatedAt.toISOString(),
    storyTitle: input.story.title,
    stageTitle: stage?.title ?? null,
    stageText,
    stageImage: stage?.image ?? null,
    players: input.game.players.map(p => ({
      id: p.id,
      characterId: p.characterId,
      characterName: characters[p.characterId]?.name ?? null,
      portrait: characters[p.characterId]?.image ?? null,
      playerName: p.playerName,
      loginKey: p.loginKey,
      joinedAt: p.joinedAt ? p.joinedAt.toISOString() : null,
    })),
  }
}
