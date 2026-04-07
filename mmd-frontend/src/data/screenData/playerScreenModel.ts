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

function asTrimmedString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined
}

function imageFromRecord(record: Record<string, unknown>): string | undefined {
  return asTrimmedString(record.image)
    ?? asTrimmedString(record.image_url)
    ?? asTrimmedString((record as { imageUrl?: unknown }).imageUrl)
    ?? asTrimmedString(record.card_image)
}

export function mapApiEventToProgressFeedItem(event: ApiGameEvent): FeedItem | null {
  const payload = event.payload ?? {}
  let text: string
  let title: string | undefined
  let body: string | undefined
  let variant: FeedVariant
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


function buildPlayerFeed(apiEvents: ApiGameEvent[], input: {
  gameState: 'SCHEDULED' | 'PLAYING' | 'REVEAL' | 'DONE' | 'CANCELLED'
  revealCards?: Array<{ id: string; text: string; act?: number }>
}): FeedItem[] {
  const defaultSystem: FeedItem[] =
    input.gameState === 'SCHEDULED'
      ? [{ id: 'pregame', type: 'system', variant: 'room', text: 'Game scheduled' }]
      : input.gameState === 'DONE'
      ? [{ id: 'done', type: 'system', variant: 'narration', text: 'Game over. Thanks for playing.' }]
      : []

  const mapped = apiEvents
    .map(mapApiEventToProgressFeedItem)
    .filter((it): it is FeedItem => Boolean(it))

  const revealItems: FeedItem[] =
    (input.gameState === 'REVEAL' || input.gameState === 'DONE') && (input.revealCards ?? []).length
      ? (input.revealCards ?? []).map(card => ({
          id: `reveal-card:${card.id}`,
          type: 'announcement',
          variant: 'narration',
          layout: 'cinematic',
          title: card.act ? `Reveal (Act ${card.act})` : 'Reveal',
          body: card.text,
          text: card.text,
        }))
      : []

  return [...defaultSystem, ...mapped, ...revealItems]
}

function buildPlayerEvidence(input: {
  clues: Array<Record<string, unknown>>
  puzzles: Array<Record<string, unknown>>
  reveals: Array<Record<string, unknown>>
  items: Array<Record<string, unknown>>
  treasures: Array<Record<string, unknown>>
  infos: Array<Record<string, unknown>>
}): EvidenceItem[] {
  const clues: EvidenceItem[] = input.clues.map((card, index) => ({
    id: String(card.id ?? `clue-${index}`),
    kind: 'clue',
    title: String(card.title ?? 'Clue'),
    text: String(card.text ?? 'Clue'),
    act: typeof card.act === 'number' ? card.act : undefined,
    image: imageFromRecord(card),
  }))

  const puzzles: EvidenceItem[] = input.puzzles.map((puzzle, index) => ({
    id: String(puzzle.id ?? `puzzle-${index}`),
    kind: 'puzzle',
    title: String(puzzle.title ?? 'Puzzle'),
    text: String(puzzle.question ?? puzzle.title ?? 'Puzzle'),
    act: typeof puzzle.act === 'number' ? puzzle.act : undefined,
    image: imageFromRecord(puzzle),
  }))

  const reveals: EvidenceItem[] = input.reveals.map((card, index) => ({
    id: String(card.id ?? `reveal-${index}`),
    kind: 'reveal',
    title: 'Reveal',
    text: String(card.text ?? 'Reveal'),
    act: typeof card.act === 'number' ? card.act : undefined,
    image: imageFromRecord(card),
  }))

  const items: EvidenceItem[] = input.items.map((item, index) => ({
    id: String(item.id ?? `item-${index}`),
    kind: 'item',
    title: String((item as { name?: unknown }).name ?? (item as { title?: unknown }).title ?? 'Item'),
    text: String((item as { description?: unknown }).description ?? (item as { text?: unknown }).text ?? ''),
    act: typeof (item as { act?: unknown }).act === 'number' ? (item as { act?: unknown }).act as number : undefined,
    image: imageFromRecord(item),
  }))

  const treasures: EvidenceItem[] = input.treasures.map((card, index) => ({
    id: String(card.id ?? `treasure-${index}`),
    kind: 'treasure',
    title: String(card.title ?? 'Treasure'),
    text: String(card.text ?? ''),
    act: typeof card.act === 'number' ? card.act : undefined,
    image: imageFromRecord(card),
  }))

  const infos: EvidenceItem[] = input.infos.map((card, index) => ({
    id: String(card.id ?? `info-${index}`),
    kind: 'info',
    title: String(card.title ?? 'Info'),
    text: String(card.text ?? ''),
    act: typeof card.act === 'number' ? card.act : undefined,
    image: imageFromRecord(card),
  }))

  return [...clues, ...puzzles, ...items, ...treasures, ...infos, ...reveals]
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
  const visibleItems: Array<Record<string, unknown>> = Array.isArray(input.visibleItems) ? input.visibleItems : []
  const visibleTreasures: Array<Record<string, unknown>> = Array.isArray(input.visibleTreasures) ? input.visibleTreasures : []
  const visibleInfos: Array<Record<string, unknown>> = Array.isArray(input.visibleInfoCards) ? input.visibleInfoCards : []
  const submittedIds = buildSubmittedObjectiveIds(input)

  const instructionCards = cards.filter(c => String(c.type ?? '') === 'instruction')
  const clueCards = cards.filter(c => String(c.type ?? '') === 'clue')
  const revealObjectiveCards = cards.filter(c => String(c.type ?? '') === 'reveal')

  const personal: ObjectiveItem[] = instructionCards.map((card, index) => ({
    id: String(card.id ?? `card-${index}`),
    text: String(card.text ?? 'Instruction'),
    completed: submittedIds.has(String(card.id ?? '')),
    act: typeof card.act === 'number' ? card.act : undefined,
    intent: 'instruction',
    image: imageFromRecord(card),
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
    image: imageFromRecord(puzzle),
  }))

  const reveals: ObjectiveItem[] = revealObjectiveCards.map((card, index) => ({
    id: String(card.id ?? `reveal-${index}`),
    text: String(card.text ?? 'Reveal'),
    completed: false,
    act: typeof card.act === 'number' ? card.act : undefined,
    intent: 'reveal',
    image: imageFromRecord(card),
  }))

  const players = (input.roomPlayers ?? []).map(player => ({
    id: player.id,
    name: player.characterName ?? player.playerName ?? `Character ${player.characterId}`,
    joinedName: typeof player.playerName === 'string' && player.playerName.trim().length > 0 ? player.playerName.trim() : undefined,
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
      : input.gameState === 'DONE'
      ? 'Game over'
      : `Act ${input.currentAct}`)

  const description = ((input.stage?.text ?? '').trim())
    || (input.gameState === 'DONE' ? 'The night has concluded.' : '')

  const banner =
    input.gameState === 'SCHEDULED'
      ? `You are ${characterName}.`
      : input.gameState === 'REVEAL'
      ? 'The final answers are now visible.'
      : input.gameState === 'DONE'
      ? 'Game over. Review the final feed and reveals.'
      : `You are ${characterName}. Stay in character.`

  const countdown = buildCountdown(input)

  const evidence = buildPlayerEvidence({
    clues: clueCards,
    puzzles,
    reveals: revealObjectiveCards,
    items: visibleItems,
    treasures: visibleTreasures,
    infos: visibleInfos,
  })
  const revealFeedCards =
    (input.unlockedCards ?? [])
      .filter(card => String((card as { type?: unknown }).type ?? '') === 'reveal')
      .map((card, index) => ({
        id: String((card as { id?: unknown }).id ?? `reveal-${index}`),
        text: String((card as { text?: unknown }).text ?? ''),
        act: typeof (card as { act?: unknown }).act === 'number' ? (card as { act?: unknown }).act as number : undefined,
      }))
      .filter(c => Boolean(c.text.trim()))

  const feed = buildPlayerFeed(input.feed ?? [], { gameState: input.gameState, revealCards: revealFeedCards })

  const secrets = Array.isArray((character as { secrets?: unknown }).secrets) ? ((character as { secrets?: unknown }).secrets as string[]) : []
  const inventoryItems = visibleItems.map((item, index) => ({
    id: String(item.id ?? `item-${index}`),
    label: String((item as { name?: unknown }).name ?? 'Item'),
    value: String((item as { description?: unknown }).description ?? ''),
    image: imageFromRecord(item),
  }))

  const portrait = typeof (character as { image?: unknown }).image === 'string' ? String((character as { image?: unknown }).image) : undefined
  const archetype = typeof (character as { archetype?: unknown }).archetype === 'string' ? String((character as { archetype?: unknown }).archetype) : undefined
  const biographyRaw = typeof (character as { biography?: unknown }).biography === 'string' ? String((character as { biography?: unknown }).biography) : undefined

  return {
    game: {
      state: input.gameState,
      act: input.currentAct,
      storyId: input.storyId,
      title,
      subtitle: input.gameName,
      hostName: input.creatorName ?? null,
      locationText: input.locationText ?? null,
      storyTitle: input.storyTitle,
      scheduledTime: input.scheduledTime,
      description,
      storyBlurb: input.storyBlurb,
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
      doNow: personal.slice(0, 3),
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
      items: inventoryItems,
      cards: clueCards.map((card, index) => ({
        id: String(card.id ?? `clue-${index}`),
        label: String(card.title ?? 'Clue'),
        value: String(card.text ?? 'Clue'),
        image: imageFromRecord(card),
      })),
    },
    composer: {
      mode: 'public',
      draft: '',
      placeholder: 'Share a note with the room.',
      recipients: [],
      canSend: false,
    },
    gameActions: input.storyId
      ? [
          { id: 'download-cards', label: 'Download as cards', kind: 'secondary' },
          { id: 'download-cards-pdf', label: 'Download PDF (Print)', kind: 'secondary' },
        ]
      : [],
    join: {
      title: title || 'Join Game',
      subtitle: input.gameName || '',
      playerName: playerNameDraft,
      submitLabel: 'Join room',
    },
  }
}
