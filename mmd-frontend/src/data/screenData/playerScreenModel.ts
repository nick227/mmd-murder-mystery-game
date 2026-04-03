import type { ApiGameEvent, EvidenceItem, FeedItem, FeedVariant, ObjectiveItem, PlayerApiView, PostMovePayload, ScreenData } from '../types'
import { portraitDataUrl } from '../../utils/portrait'
import { storyHeroImage } from '../../utils/storyHeroImage'

function buildCountdown(_input: PlayerApiView): { countdownLabel?: string; countdownPercent?: number } {
  return {}
}

function formatTimestamp(createdAt?: string): string | undefined {
  return createdAt
    ? new Date(createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    : undefined
}

export function mapApiEventToProgressFeedItem(event: ApiGameEvent): FeedItem | null {
  const payload = event.payload ?? {}
  let text = ''
  let title: string | undefined
  let body: string | undefined
  let variant: FeedVariant = 'room'
  let media: FeedItem['media'] = undefined
  let actDivider: number | undefined
  let layout: FeedItem['layout'] = 'row'

  switch (event.type) {
    case 'SYSTEM':
    case 'ANNOUNCEMENT':
      text = typeof payload.message === 'string' ? payload.message : event.type
      variant = 'narration'
      break
    case 'JOIN': {
      const p = payload as { playerName?: unknown; playerIndex?: unknown }
      const name = typeof p.playerName === 'string' ? p.playerName : null
      const index = typeof p.playerIndex === 'number' ? p.playerIndex : null
      text = name ? `${name} joined` : index !== null ? `Player ${index} joined` : 'Player joined'
      variant = 'room'
      break
    }
    case 'SUBMIT_OBJECTIVE': {
      const p = payload as {
        characterName?: unknown
        playerIndex?: unknown
        cardTitle?: unknown
        cardText?: unknown
      }
      const characterName = typeof p.characterName === 'string' && p.characterName.trim().length
        ? p.characterName.trim()
        : null
      const index = typeof p.playerIndex === 'number' ? p.playerIndex : null
      const actor = characterName ?? (index !== null ? `Player ${index}` : 'A player')
      const cardTitle = typeof p.cardTitle === 'string' && p.cardTitle.trim().length
        ? p.cardTitle.trim()
        : 'Objective'
      const cardText = typeof p.cardText === 'string' && p.cardText.trim().length
        ? p.cardText.trim()
        : ''

      text = `${actor} completed: ${cardTitle}${cardText ? `\n${cardText}` : ''}`
      title = `${actor} completed: ${cardTitle}`
      body = cardText || undefined
      variant = 'mechanic'
      break
    }
    case 'START_GAME':
      text = 'Game started'
      variant = 'narration'
      actDivider = 1
      layout = 'cinematic'
      media = typeof (payload as { stageImage?: unknown }).stageImage === 'string'
        ? { src: String((payload as { stageImage?: unknown }).stageImage), alt: 'Act scene', ratio: '16:9', variant: 'hero', fallback: { type: 'gradient' } }
        : undefined
      break
    case 'ADVANCE_ACT': {
      const p = payload as { act?: unknown; stageImage?: unknown }
      const act = typeof p.act === 'number' ? p.act : undefined
      text = typeof act === 'number' ? `Act ${act} started` : 'Act advanced'
      variant = 'narration'
      actDivider = act
      layout = 'cinematic'
      media = typeof p.stageImage === 'string'
        ? { src: String(p.stageImage), alt: 'Act scene', ratio: '16:9', variant: 'hero', fallback: { type: 'gradient' } }
        : undefined
      break
    }
    case 'ACT_CHANGED':
      text = typeof payload.act === 'number' ? `Act ${payload.act} started` : 'Act changed'
      variant = 'room'
      break
    case 'STAGE_UPDATED':
      text = typeof payload.title === 'string' ? `Stage updated: ${payload.title}` : 'Host updated the stage.'
      variant = 'narration'
      break
    case 'POST_MOVE': {
      const p = payload as Partial<PostMovePayload>
      const author = typeof p.characterName === 'string' ? p.characterName : undefined
      const authorPortrait = typeof p.characterPortrait === 'string' ? p.characterPortrait : undefined
      const moveText = typeof p.text === 'string' ? p.text.trim() : ''
      const feedId = typeof p.clientRequestId === 'string' && p.clientRequestId.trim().length ? p.clientRequestId : event.id

      return {
        id: feedId,
        type: 'chat',
        variant: 'social',
        text: moveText || 'Post',
        author,
        authorPortrait,
        timestamp: formatTimestamp(event.createdAt),
      }
    }
    default:
      text = String(payload.message ?? event.type)
      variant = 'room'
  }

  return {
    id: event.id,
    type: event.type === 'ANNOUNCEMENT' ? 'announcement' : 'system',
    variant,
    media,
    layout,
    actDivider,
    title,
    body,
    text,
    timestamp: formatTimestamp(event.createdAt),
  }
}

function applyNarrationBlockRule(input: FeedItem[]): FeedItem[] {
  const isNarration = (it: FeedItem) => (it.variant ?? 'room') === 'narration'
  const isRoom = (it: FeedItem) => (it.variant ?? 'room') === 'room'

  const out: FeedItem[] = []
  let i = 0
  while (i < input.length) {
    const current = input[i]
    if (!isNarration(current)) {
      out.push(current)
      i++
      continue
    }

    const narrationBlock: FeedItem[] = []
    const postponedRoom: FeedItem[] = []

    while (i < input.length) {
      const it = input[i]
      if (isNarration(it)) {
        narrationBlock.push(it)
        i++
        continue
      }
      if (isRoom(it)) {
        postponedRoom.push(it)
        i++
        continue
      }
      break
    }

    out.push(...narrationBlock, ...postponedRoom)
  }

  return out
}

function computeNarrationStacking(input: FeedItem[]): FeedItem[] {
  const isNarration = (it: FeedItem) => (it.variant ?? 'room') === 'narration'
  const out = input.slice()

  for (let i = 0; i < out.length; i++) {
    const cur = out[i]
    if (!isNarration(cur)) continue
    const prev = out[i - 1]
    const next = out[i + 1]
    const prevIsNarration = prev ? isNarration(prev) : false
    const nextIsNarration = next ? isNarration(next) : false
    cur.stacking = prevIsNarration || nextIsNarration
      ? (prevIsNarration && nextIsNarration ? 'mid' : prevIsNarration ? 'end' : 'start')
      : 'solo'
  }

  return out
}

function buildPlayerFeed(apiEvents: ApiGameEvent[], input: {
  gameState: 'SCHEDULED' | 'PLAYING' | 'REVEAL' | 'DONE' | 'CANCELLED'
  revealAnswers?: Array<{ track: 'who' | 'how' | 'why'; answer: string }>
}): FeedItem[] {
  const defaultSystem: FeedItem[] = input.gameState === 'SCHEDULED'
    ? [{ id: 'pregame', type: 'system', variant: 'room', text: 'Game scheduled' }]
    : []

  const mapped = apiEvents
    .map(mapApiEventToProgressFeedItem)
    .filter((it): it is FeedItem => Boolean(it))

  const revealItems: FeedItem[] = (input.revealAnswers ?? []).map(answer => ({
    id: `reveal-${answer.track}`,
    type: 'announcement',
    text: `${answer.track.toUpperCase()}: ${answer.answer}`,
  }))

  return computeNarrationStacking(applyNarrationBlockRule([...defaultSystem, ...mapped, ...revealItems]))
}

function buildPlayerEvidence(input: {
  clues: Array<Record<string, unknown>>
  puzzles: Array<Record<string, unknown>>
  reveals: Array<Record<string, unknown>>
}): EvidenceItem[] {
  const clues: EvidenceItem[] = input.clues.map((card, index) => ({
    id: String(card.id ?? `clue-${index}`),
    kind: 'clue',
    title: String(card.title ?? 'Clue'),
    text: String(card.text ?? 'Clue'),
    act: typeof card.act === 'number' ? card.act : undefined,
    image: typeof (card as { image?: unknown }).image === 'string' ? String((card as { image?: unknown }).image) : undefined,
  }))

  const puzzles: EvidenceItem[] = input.puzzles.map((puzzle, index) => ({
    id: String(puzzle.id ?? `puzzle-${index}`),
    kind: 'puzzle',
    title: String(puzzle.title ?? 'Puzzle'),
    text: String(puzzle.question ?? puzzle.title ?? 'Puzzle'),
    act: typeof puzzle.act === 'number' ? puzzle.act : undefined,
    image: typeof (puzzle as { image?: unknown }).image === 'string' ? String((puzzle as { image?: unknown }).image) : undefined,
  }))

  const reveals: EvidenceItem[] = input.reveals.map((card, index) => ({
    id: String(card.id ?? `reveal-${index}`),
    kind: 'reveal',
    title: 'Reveal',
    text: String(card.text ?? 'Reveal'),
    act: typeof card.act === 'number' ? card.act : undefined,
    image: typeof (card as { image?: unknown }).image === 'string' ? String((card as { image?: unknown }).image) : undefined,
  }))

  return [...clues, ...puzzles, ...reveals]
}

function buildSubmittedObjectiveIds(input: PlayerApiView): Set<string> {
  return new Set(
    (input.feed ?? [])
      .filter(e => e.type === 'SUBMIT_OBJECTIVE')
      .map(e => String((e.payload as { cardId?: unknown } | undefined)?.cardId ?? ''))
      .filter(Boolean),
  )
}

export function buildPlayerScreenModel(input: PlayerApiView, playerNameDraft: string): ScreenData {
  const character = input.character ?? {}
  const characterName = String((character as { name?: unknown }).name ?? `Character ${input.characterId}`)

  const cards: Array<Record<string, unknown>> = Array.isArray(input.unlockedCards) ? input.unlockedCards : []
  const puzzles: Array<Record<string, unknown>> = Array.isArray(input.unlockedPuzzles) ? input.unlockedPuzzles : []
  const submittedIds = buildSubmittedObjectiveIds(input)

  const instructionCards = cards.filter(c => String(c.type ?? '') === 'instruction')
  const clueCards = cards.filter(c => String(c.type ?? '') === 'clue')
  const revealCards = cards.filter(c => String(c.type ?? '') === 'reveal')

  const personal: ObjectiveItem[] = instructionCards.map((card, index) => ({
    id: String(card.id ?? `card-${index}`),
    text: String(card.text ?? 'Instruction'),
    completed: submittedIds.has(String(card.id ?? '')),
    act: typeof card.act === 'number' ? card.act : undefined,
    intent: 'instruction',
  }))

  const group: ObjectiveItem[] = puzzles.map((puzzle, index) => ({
    id: String(puzzle.id ?? `puzzle-${index}`),
    text: String(puzzle.question ?? puzzle.title ?? 'Group clue'),
    completed: submittedIds.has(String(puzzle.id ?? '')),
    group: true,
    act: typeof puzzle.act === 'number' ? puzzle.act : undefined,
    intent: typeof (puzzle as { intent?: unknown }).intent === 'string'
      ? ((puzzle as { intent?: unknown }).intent as ObjectiveItem['intent'])
      : undefined,
  }))

  const reveals: ObjectiveItem[] = revealCards.map((card, index) => ({
    id: String(card.id ?? `reveal-${index}`),
    text: String(card.text ?? 'Reveal'),
    completed: false,
    act: typeof card.act === 'number' ? card.act : undefined,
    intent: 'reveal',
  }))

  const players = (input.roomPlayers ?? []).map(player => ({
    id: player.id,
    name: player.characterName ?? player.playerName ?? `Character ${player.characterId}`,
    characterId: player.characterId,
    online: Boolean(player.joinedAt),
    portrait: typeof player.portrait === 'string' && player.portrait.trim().length > 0
      ? player.portrait
      : portraitDataUrl(player.characterName ?? player.playerName ?? `Character ${player.characterId}`),
  }))

  const title =
    input.stage?.title
    ?? (input.gameState === 'SCHEDULED'
      ? 'Pregame room'
      : input.gameState === 'REVEAL'
      ? 'Final reveal'
      : `Act ${input.currentAct}`)

  const description =
    input.storyBlurb
    ?? (input.gameState === 'SCHEDULED'
      ? (input.playerName ? 'You are waiting for the game to start.' : '')
      : input.gameState === 'REVEAL'
      ? ''
      : '')

  const banner =
    input.gameState === 'SCHEDULED'
      ? `You are ${characterName}.`
      : input.gameState === 'REVEAL'
      ? 'The final answers are now visible.'
      : `You are ${characterName}. Stay in character.`

  const countdown = buildCountdown(input)

  const evidence = buildPlayerEvidence({ clues: clueCards, puzzles, reveals: revealCards })
  const feed = buildPlayerFeed(input.feed ?? [], { gameState: input.gameState, revealAnswers: input.mysteryAnswers })

  const secrets = Array.isArray((character as { secrets?: unknown }).secrets) ? ((character as { secrets?: unknown }).secrets as string[]) : []
  const items = Array.isArray((character as { items?: unknown }).items) ? ((character as { items?: unknown }).items as string[]) : []

  const portrait = typeof (character as { image?: unknown }).image === 'string' ? String((character as { image?: unknown }).image) : undefined
  const archetype = typeof (character as { archetype?: unknown }).archetype === 'string' ? String((character as { archetype?: unknown }).archetype) : undefined
  const biographyRaw = typeof (character as { biography?: unknown }).biography === 'string' ? String((character as { biography?: unknown }).biography) : undefined

  return {
    game: {
      state: input.gameState,
      act: input.currentAct,
      title,
      subtitle: input.gameName,
      storyTitle: input.storyTitle,
      scheduledTime: input.scheduledTime,
      description,
      storyBlurb: input.storyBlurb ?? description,
      actText: input.stage?.text ?? '',
      storyImage: storyHeroImage(input.storyImage),
      image: input.stage?.image ?? undefined,
      countdownLabel: countdown.countdownLabel,
      countdownPercent: countdown.countdownPercent,
      banner,
    },
    players,
    feed,
    view: {
      doNow: personal.filter(o => !o.completed).slice(0, 3),
      evidence,
    },
    objectives: {
      personal,
      group,
      reveals,
    },
    profile: {
      characterName,
      archetype,
      biography: biographyRaw && biographyRaw.trim().length ? biographyRaw : 'Your persona is part of this story. Stay in character and pursue your goals.',
      portrait: portrait ?? portraitDataUrl(characterName),
      secrets: secrets.map((value, index) => ({ id: `secret-${index}`, label: 'Secret', value })),
      items: items.map((value, index) => ({ id: `item-${index}`, label: 'Item', value })),
      cards: clueCards.map((card, index) => ({
        id: String(card.id ?? `clue-${index}`),
        label: String(card.title ?? 'Clue'),
        value: String(card.text ?? 'Clue'),
      })),
    },
    composer: {
      mode: 'public',
      draft: '',
      placeholder: 'Share a note with the room.',
      recipients: [],
      canSend: false,
    },
    gameActions: [],
    join: {
      title: '',
      subtitle: '',
      playerName: playerNameDraft,
      submitLabel: 'Join room',
    },
  }
}
