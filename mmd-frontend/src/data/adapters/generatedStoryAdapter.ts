import type { StoryListItem } from '../types'
import type { RuntimeBundle, RuntimeCard, RuntimeCardIntent, RuntimePlayer, RuntimeStage, RuntimeStory } from '../runtime/types'
import { normalizeRuntimeStory } from '../runtime/normalize'

export interface AdapterDiagnostic {
  level: 'warn' | 'error'
  message: string
  cardId?: string
  cardType?: string
  path?: string
}

interface GeneratedCard {
  card_id?: unknown
  card_type?: unknown
  card_title?: unknown
  card_contents?: unknown
  act?: unknown
  linked_character_id?: unknown
  [key: string]: unknown
}

interface GeneratedStoryRun {
  runId?: unknown
  playerCount?: unknown
  cards?: unknown
  [key: string]: unknown
}

export interface GeneratedStoryAdapted {
  storyListItem: StoryListItem
  runtimeStory: RuntimeStory
  diagnostics: AdapterDiagnostic[]
}

function asString(value: unknown): string | null {
  return typeof value === 'string' ? value : null
}

function asNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null
}

function asCardArray(value: unknown): GeneratedCard[] | null {
  return Array.isArray(value) ? (value as GeneratedCard[]) : null
}

function firstMeta(cards: GeneratedCard[], title: string): string | null {
  const found = cards.find(c => asString(c.card_type) === 'story_meta' && asString(c.card_title) === title)
  return found ? asString(found.card_contents) : null
}

function cardAct(value: GeneratedCard): number | null {
  return asNumber(value.act)
}

function idFromCard(card: GeneratedCard): string | null {
  return asString(card.card_id)
}

function typeFromCard(card: GeneratedCard): string | null {
  return asString(card.card_type)
}

function titleFromCard(card: GeneratedCard): string | null {
  return asString(card.card_title)
}

function contentsFromCard(card: GeneratedCard): string | null {
  return asString(card.card_contents)
}

function stableLocalId(input: string): string {
  // deterministic, small, url-safe
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `local-${(hash >>> 0).toString(16)}`
}

function buildStage(cards: GeneratedCard[], currentAct: number) {
  const actCard = cards.find(c => typeFromCard(c) === 'story_act' && cardAct(c) === currentAct)
  return actCard
    ? { title: titleFromCard(actCard) ?? `Act ${currentAct}`, text: contentsFromCard(actCard) ?? '' }
    : null
}

function filterUnlocked(cards: GeneratedCard[], currentAct: number, type: string): GeneratedCard[] {
  return cards.filter(c => typeFromCard(c) === type && (cardAct(c) ?? 1) <= currentAct)
}

function summarizeUnmappedKeys(card: GeneratedCard): string[] {
  const allowed = new Set([
    'card_id',
    'card_type',
    'card_title',
    'card_contents',
    'act',
    'linked_character_id',
  ])
  return Object.keys(card).filter(key => !allowed.has(key))
}

function requiredString(
  diagnostics: AdapterDiagnostic[],
  card: GeneratedCard,
  key: 'card_id' | 'card_type' | 'card_contents',
): string | null {
  const cardId = idFromCard(card) ?? undefined
  const cardType = typeFromCard(card) ?? undefined
  const value = asString(card[key])
  if (!value) {
    diagnostics.push({ level: 'warn', message: `Missing required field ${key}`, cardId, cardType, path: key })
    return null
  }
  return value
}

function intentFromCardType(cardType: string): RuntimeCardIntent | null {
  if (cardType === 'game_card') return 'instruction'
  if (cardType === 'clue') return 'clue'
  if (cardType === 'puzzle') return 'puzzle'
  if (cardType === 'solution') return 'reveal'
  if (cardType === 'host_speech') return 'info'
  if (cardType === 'story_act') return 'info'
  if (cardType === 'secret') return 'info'
  if (cardType === 'item') return 'info'
  if (cardType === 'treasure') return 'info'
  return null
}

export function adaptGeneratedStoryRunToRuntime(
  raw: unknown,
): GeneratedStoryAdapted {
  const diagnostics: AdapterDiagnostic[] = []

  const run = (raw ?? {}) as GeneratedStoryRun
  const cards = asCardArray(run.cards) ?? []
  if (!Array.isArray(run.cards)) {
    diagnostics.push({ level: 'error', message: 'Expected root.cards to be an array', path: 'cards' })
  }

  const storyTitle = firstMeta(cards, 'Story title') ?? 'Untitled story'
  const storyDescription = firstMeta(cards, 'Story description') ?? 'Generated story JSON loaded locally.'
  const playerCount = asNumber(run.playerCount) ?? 0
  if (!asString(run.runId)) {
    diagnostics.push({ level: 'warn', message: 'Missing runId (recommended for traceability)', path: 'runId' })
  }
  if (!asNumber(run.playerCount)) {
    diagnostics.push({ level: 'warn', message: 'Missing playerCount (recommended for playtest UX)', path: 'playerCount' })
  }

  const characterCards = cards.filter(c => typeFromCard(c) === 'character')
  if (characterCards.length === 0) {
    diagnostics.push({ level: 'error', message: 'No character cards found (card_type="character")' })
  }

  const playersByCharacterId: Record<string, RuntimePlayer> = {}
  const playerOrder: string[] = []
  for (const card of characterCards) {
    const characterId = idFromCard(card)
    if (!characterId) continue
    playerOrder.push(characterId)
    playersByCharacterId[characterId] = {
      characterId,
      name: titleFromCard(card) ?? `Character ${characterId}`,
      biography: contentsFromCard(card) ?? undefined,
      secrets: [],
    }
  }

  const secretsByCharacterId: Record<string, string[]> = {}
  const secretCards = cards.filter(c => typeFromCard(c) === 'secret')
  for (const card of secretCards) {
    const linkedId = asString(card.linked_character_id)
    const secret = contentsFromCard(card)
    if (!linkedId) {
      diagnostics.push({ level: 'warn', message: 'Secret card missing linked_character_id', cardId: idFromCard(card) ?? undefined, cardType: 'secret', path: 'linked_character_id' })
      continue
    }
    if (!secret) {
      diagnostics.push({ level: 'warn', message: 'Secret card missing card_contents', cardId: idFromCard(card) ?? undefined, cardType: 'secret', path: 'card_contents' })
      continue
    }
    ;(secretsByCharacterId[linkedId] ??= []).push(secret)
  }

  for (const [characterId, secrets] of Object.entries(secretsByCharacterId)) {
    const player = playersByCharacterId[characterId]
    if (!player) continue
    player.secrets = secrets
  }

  for (const card of cards) {
    const cardType = typeFromCard(card)
    const cardId = idFromCard(card) ?? undefined
    if (!cardType) {
      diagnostics.push({ level: 'warn', message: 'Card missing card_type', cardId, path: 'card_type' })
      continue
    }
    const unmapped = summarizeUnmappedKeys(card)
    if (unmapped.length > 0) {
      diagnostics.push({
        level: 'warn',
        message: `Unmapped fields present: ${unmapped.slice(0, 8).join(', ')}${unmapped.length > 8 ? ', …' : ''}`,
        cardId,
        cardType,
      })
    }
    const known = new Set([
      'story_meta',
      'story_act',
      'character',
      'person',
      'location',
      'item',
      'secret',
      'puzzle',
      'host_speech',
      'clue',
    ])
    if (!known.has(cardType)) {
      diagnostics.push({ level: 'warn', message: `Unknown card_type="${cardType}"`, cardId, cardType })
    }
  }

  const stageByAct: Record<number, RuntimeStage> = {}
  const actCards = cards.filter(c => typeFromCard(c) === 'story_act')
  for (const card of actCards) {
    const act = cardAct(card) ?? 1
    stageByAct[act] = {
      act,
      title: titleFromCard(card) ?? `Act ${act}`,
      text: contentsFromCard(card) ?? '',
    }
  }

  const runtimeCards: RuntimeCard[] = []
  const bundlesById: Record<string, RuntimeBundle> = {}

  for (const card of cards) {
    const cardType = requiredString(diagnostics, card, 'card_type')
    const cardId = requiredString(diagnostics, card, 'card_id')
    const text = requiredString(diagnostics, card, 'card_contents')
    if (!cardType || !cardId || !text) continue

    const act = cardAct(card) ?? 1
    const intent = intentFromCardType(cardType)
    if (!intent) {
      diagnostics.push({ level: 'warn', message: `No intent mapping for card_type="${cardType}"`, cardId, cardType })
      continue
    }

    const base = {
      id: cardId,
      act,
      intent,
      title: titleFromCard(card) ?? undefined,
      text,
      source: { cardType, cardId },
    }

    if (intent === 'instruction') {
      runtimeCards.push({
        ...base,
        intent,
        targetCharacterId: asString(card.target_character_id) ?? null,
      })
      continue
    }

    if (intent === 'puzzle') {
      const bundleId = asString(card.bundle_id) ?? null
      const unlockCardIds = Array.isArray(card.unlock_card_ids) ? (card.unlock_card_ids as string[]) : undefined
      const requiredCardIds = Array.isArray(card.required_card_ids) ? (card.required_card_ids as string[]) : undefined
      const hiddenUntilSolved = typeof card.hidden_until_solved === 'boolean' ? card.hidden_until_solved : undefined

      const puzzleCard: RuntimeCard = {
        ...base,
        intent,
        bundleId,
        unlockCardIds,
        requiredCardIds,
        hiddenUntilSolved,
      }
      runtimeCards.push(puzzleCard)

      if (bundleId) {
        const bundle = (bundlesById[bundleId] ??= { id: bundleId, act, cards: [] })
        bundle.cards.push(puzzleCard)
        bundle.requiredCardIds = requiredCardIds ?? bundle.requiredCardIds
        bundle.unlockCardIds = unlockCardIds ?? bundle.unlockCardIds
      }
      continue
    }

    if (intent === 'reveal') {
      runtimeCards.push({
        ...(base as any),
        intent,
        bundleId: asString(card.bundle_id) ?? null,
        hiddenUntilSolved: typeof card.hidden_until_solved === 'boolean' ? card.hidden_until_solved : undefined,
      } as RuntimeCard)
      continue
    }

    runtimeCards.push(base as RuntimeCard)
  }

  const storyListItem: StoryListItem = {
    id: stableLocalId(storyTitle),
    title: storyTitle,
    summary: storyDescription,
    createdAt: asString(run.runId) ?? undefined,
  }

  const runtimeStory: RuntimeStory = {
    id: stableLocalId(storyTitle),
    title: storyTitle,
    summary: storyDescription,
    playerCount,
    playerOrder,
    stageByAct,
    playersByCharacterId,
    cards: runtimeCards,
    bundles: Object.values(bundlesById),
  }

  return { storyListItem, runtimeStory: normalizeRuntimeStory(runtimeStory, diagnostics), diagnostics }
}

