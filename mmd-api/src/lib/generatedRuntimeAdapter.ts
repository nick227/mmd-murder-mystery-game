import type { RuntimeBundle, RuntimeCard, RuntimeCardIntent, RuntimePlayer, RuntimeStage, RuntimeStory, RuntimeItem } from './runtimeStory.js'

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
  storyBlurb?: unknown
  [key: string]: unknown
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

function imageFromCard(card: GeneratedCard): string | null {
  // Optional, forward-compatible fields the generator may emit later.
  // We do not require these; runtime remains playable without imagery.
  const anyCard = card as any
  return asString(anyCard.image)
    ?? asString(anyCard.image_url)
    ?? asString(anyCard.imageUrl)
    ?? asString(anyCard.card_image)
    ?? null
}

function stableLocalId(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `local-${(hash >>> 0).toString(16)}`
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

function actsPresent(story: RuntimeStory): number[] {
  const acts = new Set<number>()
  for (const key of Object.keys(story.stageByAct)) {
    const n = Number(key)
    if (Number.isInteger(n) && n > 0) acts.add(n)
  }
  for (const card of story.cards) acts.add(card.act)
  return Array.from(acts).sort((a, b) => a - b)
}

function ensureRevealExists(story: RuntimeStory, diagnostics: AdapterDiagnostic[]) {
  const hasReveal = story.cards.some(c => c.intent === 'reveal')
  if (hasReveal) return
  diagnostics.push({ level: 'warn', message: 'No reveal cards found; injecting fallback reveal for playability.' })
  story.cards.push({
    id: stableLocalId(`${story.id}:fallback-reveal:act1`),
    act: 1,
    intent: 'reveal',
    title: 'Reveal',
    text: 'A reveal becomes available after a player submits an objective.',
    source: { cardType: 'synthetic', cardId: 'fallback-reveal' },
    hiddenUntilSolved: true,
    bundleId: null,
  })
}

function ensurePlayerObjective(story: RuntimeStory, diagnostics: AdapterDiagnostic[]) {
  const hasInstruction = story.cards.some(c => c.intent === 'instruction')
  if (hasInstruction) return

  const firstPuzzle = story.cards.find(c => c.intent === 'puzzle')
  if (firstPuzzle) {
    diagnostics.push({ level: 'warn', message: 'No instruction cards found; promoting first puzzle to an instruction.' })
    story.cards.push({
      id: stableLocalId(`${story.id}:promoted-instruction:${firstPuzzle.id}`),
      act: firstPuzzle.act,
      intent: 'instruction',
      title: firstPuzzle.title ?? 'Objective',
      text: firstPuzzle.text,
      source: { cardType: 'synthetic', cardId: 'promoted-puzzle' },
      targetCharacterId: null,
    })
    return
  }

  diagnostics.push({ level: 'warn', message: 'No instruction or puzzle cards found; injecting fallback instruction.' })
  story.cards.push({
    id: stableLocalId(`${story.id}:fallback-instruction:act1`),
    act: 1,
    intent: 'instruction',
    title: 'Objective',
    text: 'Introduce yourself in character, ask one question, and share one suspicion.',
    source: { cardType: 'synthetic', cardId: 'fallback-instruction' },
    targetCharacterId: null,
  })
}

function ensureActPlayable(story: RuntimeStory, diagnostics: AdapterDiagnostic[]) {
  const acts = actsPresent(story)
  for (const act of acts) {
    const hasActContent = story.cards.some(c => c.act === act && (c.intent === 'instruction' || c.intent === 'puzzle'))
    if (hasActContent) continue
    diagnostics.push({ level: 'warn', message: `Act ${act} has no instruction/puzzle; injecting fallback instruction.` })
    story.cards.push({
      id: stableLocalId(`${story.id}:fallback-instruction:act${act}`),
      act,
      intent: 'instruction',
      title: `Act ${act} objective`,
      text: 'Share one new theory and ask another player about their alibi.',
      source: { cardType: 'synthetic', cardId: `fallback-instruction-act-${act}` },
      targetCharacterId: null,
    })
  }
}

function ensureClueOrPuzzleExists(story: RuntimeStory, diagnostics: AdapterDiagnostic[]) {
  const hasAny = story.cards.some(c => c.intent === 'clue' || c.intent === 'puzzle')
  if (hasAny) return

  diagnostics.push({ level: 'warn', message: 'No clue or puzzle cards found; injecting fallback clue(s) for playability.' })
  const ids = story.playerOrder.length ? story.playerOrder : Object.keys(story.playersByCharacterId)
  const names = ids.map(id => story.playersByCharacterId[id]?.name).filter(Boolean)

  if (!names.length) {
    story.cards.push({
      id: stableLocalId(`${story.id}:fallback-clue:act1`),
      act: 1,
      intent: 'clue',
      title: 'Clue',
      text: 'A small inconsistency stands out — ask others what they noticed and compare notes.',
      source: { cardType: 'synthetic', cardId: 'fallback-clue' },
    })
    return
  }

  for (const name of names) {
    story.cards.push({
      id: stableLocalId(`${story.id}:fallback-clue:${name}:act1`),
      act: 1,
      intent: 'clue',
      title: 'Clue',
      text: 'You spot a detail that doesn’t quite add up — share it and see who reacts.',
      source: { cardType: 'synthetic', cardId: 'fallback-clue' },
      linked_character: name,
    } as any)
  }
}

export function adaptGeneratedStoryToRuntime(raw: unknown): { runtimeStory: RuntimeStory; diagnostics: AdapterDiagnostic[] } {
  const diagnostics: AdapterDiagnostic[] = []
  const run = (raw ?? {}) as GeneratedStoryRun
  const cards = asCardArray(run.cards) ?? []
  if (!Array.isArray(run.cards)) diagnostics.push({ level: 'error', message: 'Expected root.cards to be an array', path: 'cards' })
  if (!asString(run.runId)) diagnostics.push({ level: 'warn', message: 'Missing runId (recommended for traceability)', path: 'runId' })
  if (!asNumber(run.playerCount)) diagnostics.push({ level: 'warn', message: 'Missing playerCount (recommended for playtest UX)', path: 'playerCount' })

  const storyTitle = firstMeta(cards, 'Story title') ?? 'Untitled story'
  // Prefer root-level storyBlurb (richer, set by story_blurb_agent) over the story_meta card.
  const storyDescription = asString(run.storyBlurb) ?? firstMeta(cards, 'Story description') ?? 'Generated story JSON loaded locally.'
  const playerCount = asNumber(run.playerCount) ?? 0

  const characterCards = cards.filter(c => typeFromCard(c) === 'character')
  const playersByCharacterId: Record<string, RuntimePlayer> = {}
  const playerOrder: string[] = []
  // Track full card_title per character for dual-key name resolution.
  const fullTitleByCharacterId: Record<string, string> = {}
  for (const card of characterCards) {
    const characterId = idFromCard(card)
    if (!characterId) continue
    playerOrder.push(characterId)
    // Support 'Name — Archetype' title pattern (Grunge+ schema).
    // Short name is the display/match key; archetype is pulled from title or explicit field.
    const fullTitle = titleFromCard(card) ?? `Character ${characterId}`
    const emDashIdx = fullTitle.indexOf(' \u2014 ')
    const displayName = emDashIdx >= 0 ? fullTitle.slice(0, emDashIdx).trim() : fullTitle
    const titleArchetype = emDashIdx >= 0 ? fullTitle.slice(emDashIdx + 3).trim() : undefined
    const archetype = asString((card as any).archetype) ?? titleArchetype ?? undefined
    fullTitleByCharacterId[characterId] = fullTitle
    playersByCharacterId[characterId] = {
      characterId,
      name: displayName,
      archetype,
      biography: contentsFromCard(card) ?? undefined,
      image: imageFromCard(card) ?? undefined,
      secrets: [],
      items: [],
    }
  }

  // Dual-key name map: keys on both short display name AND full title (with archetype suffix).
  // This makes linked_character resolution work regardless of which form the generator emits.
  const characterIdByName: Record<string, string> = {}
  for (const p of Object.values(playersByCharacterId)) {
    characterIdByName[p.name] = p.characterId                          // short name key
    const full = fullTitleByCharacterId[p.characterId]
    if (full && full !== p.name) characterIdByName[full] = p.characterId  // full title key
  }

  const secretsByCharacterId: Record<string, string[]> = {}
  const secretCards = cards.filter(c => typeFromCard(c) === 'secret')
  for (const card of secretCards) {
    const linkedName = asString(card.linked_character)
    const linkedId = asString(card.linked_character_id)
    // Prefer name-based lookup (new schema); fall back to raw id (Jekyll legacy).
    const targetId = (linkedName ? characterIdByName[linkedName] : null) ?? linkedId
    const secret = contentsFromCard(card)
    if (!targetId || !secret) continue
    ;(secretsByCharacterId[targetId] ??= []).push(secret)
  }
  for (const [characterId, secrets] of Object.entries(secretsByCharacterId)) {
    if (playersByCharacterId[characterId]) playersByCharacterId[characterId].secrets = secrets
  }

  const itemsByCharacterId: Record<string, RuntimeItem[]> = {}
  const itemCards = cards.filter(c => typeFromCard(c) === 'item')
  for (const card of itemCards) {
    const linkedName = asString(card.linked_character)
    const targetId = linkedName ? characterIdByName[linkedName] : null
    if (!targetId) continue

    const itemCardId = idFromCard(card)
    if (!itemCardId) continue

    const act = cardAct(card) ?? 1
    ;(itemsByCharacterId[targetId] ??= []).push({
      id: itemCardId,
      name: titleFromCard(card) ?? 'Unknown Item',
      description: contentsFromCard(card) ?? '',
      act,
      locationRef: asString(card.location_ref) ?? null,
    })
  }
  for (const [characterId, items] of Object.entries(itemsByCharacterId)) {
    if (playersByCharacterId[characterId]) playersByCharacterId[characterId].items = items
  }

  const stageByAct: Record<number, RuntimeStage> = {}
  const actCards = cards.filter(c => typeFromCard(c) === 'story_act')
  for (const card of actCards) {
    const act = cardAct(card) ?? 1
    stageByAct[act] = {
      act,
      title: titleFromCard(card) ?? `Act ${act}`,
      text: contentsFromCard(card) ?? '',
      image: imageFromCard(card) ?? undefined,
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
    if (!intent) continue

    const linkedCharacterRaw = asString(card.linked_character) ?? null

    // Normalise linked_character to the short display name so visibleToMe
    // comparison (linked_character === player.name) is always short vs short.
    // Resolves both 'Lena Voss' and 'Lena Voss — The Underground Queen' to 'Lena Voss'.
    const resolvedCharId = linkedCharacterRaw ? characterIdByName[linkedCharacterRaw] : null
    const linkedCharacter = resolvedCharId
      ? (playersByCharacterId[resolvedCharId]?.name ?? linkedCharacterRaw)
      : linkedCharacterRaw

    // Drift detection: warn if linked_character failed to resolve to any known character.
    if (linkedCharacterRaw && !resolvedCharId) {
      diagnostics.push({
        level: 'warn',
        message: `Unknown linked_character "${linkedCharacterRaw}" — no matching character card found`,
        cardId,
        cardType,
      })
    }

    const base = {
      id: cardId,
      act,
      intent,
      title: titleFromCard(card) ?? undefined,
      text,
      source: { cardType, cardId },
      linked_character: linkedCharacter,
    }

    if (intent === 'instruction') {
      runtimeCards.push({
        ...base,
        intent,
        targetCharacterId: asString(card.target_character_id) ?? null,
      } as any)
      continue
    }

    if (intent === 'clue') {
      runtimeCards.push({
        ...base,
        intent,
        suspectName: asString(card.suspect_name) ?? null,
        clueType: asString(card.clue_type) ?? null,
        clueWeight: asString(card.clue_weight) ?? null,
      } as any)
      continue
    }

    if (intent === 'puzzle') {
      const bundleId = asString(card.bundle_id) ?? null
      const unlockCardIds = Array.isArray(card.unlock_card_ids) ? (card.unlock_card_ids as string[]) : undefined
      const requiredCardIds = Array.isArray(card.required_card_ids) ? (card.required_card_ids as string[]) : undefined
      const hiddenUntilSolved = typeof card.hidden_until_solved === 'boolean' ? card.hidden_until_solved : undefined
      const puzzleCard = { ...base, intent, bundleId, unlockCardIds, requiredCardIds, hiddenUntilSolved } as any
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
      } as any)
      continue
    }

    runtimeCards.push(base as any)
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

  if (!runtimeStory.playerOrder.length) runtimeStory.playerOrder = Object.keys(runtimeStory.playersByCharacterId)

  ensurePlayerObjective(runtimeStory, diagnostics)
  ensureRevealExists(runtimeStory, diagnostics)
  ensureClueOrPuzzleExists(runtimeStory, diagnostics)
  ensureActPlayable(runtimeStory, diagnostics)

  return { runtimeStory, diagnostics }
}
