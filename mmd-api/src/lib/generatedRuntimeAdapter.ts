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
  storyTitle?: unknown
  story_title?: unknown
  title?: unknown
  userPrompt?: unknown
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

function normalizeTitle(value: string | null): string | null {
  if (!value) return null
  const normalized = value.trim().replace(/\s+/g, ' ')
  return normalized.length ? normalized : null
}

function titleFromRunId(runId: string | null): string | null {
  const raw = normalizeTitle(runId)
  if (!raw) return null

  // Expected format: "<title>-<timestamp>-<suffix>"
  const stripped = raw
    .replace(/-\d{10,}-[a-z0-9]+$/i, '')
    .replace(/-\d{10,}$/i, '')
    .trim()
  return normalizeTitle(stripped) ?? raw
}

function deriveStoryTitle(run: GeneratedStoryRun, cards: GeneratedCard[]): string {
  return (
    normalizeTitle(firstMeta(cards, 'Story title'))
    ?? normalizeTitle(asString(run.storyTitle))
    ?? normalizeTitle(asString(run.story_title))
    ?? normalizeTitle(asString(run.title))
    ?? titleFromRunId(asString(run.runId))
    ?? normalizeTitle(asString(run.userPrompt))
    ?? 'Untitled story'
  )
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

function stableIndex(input: string, mod: number): number {
  if (mod <= 0) return 0
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return Math.abs(hash >>> 0) % mod
}

function normalizeKey(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLowerCase()
}

function extractTaggedValue(text: string | null, tags: string[]): string | null {
  if (!text) return null
  for (const tag of tags) {
    const re = new RegExp(`^\\s*${tag}\\s*:\\s*(.+)$`, 'im')
    const m = text.match(re)
    if (!m?.[1]) continue
    const value = m[1].trim()
    if (value.length) return value
  }
  return null
}

function pushNarrativeDriftDiagnostics(input: {
  cards: GeneratedCard[]
  diagnostics: AdapterDiagnostic[]
  knownVictims: Set<string>
  knownLocations: Set<string>
}) {
  const victimMentions = new Map<string, { sample: string; count: number; cardId?: string; cardType?: string }>()
  const locationMentions = new Map<string, { sample: string; count: number; cardId?: string; cardType?: string }>()

  for (const card of input.cards) {
    const text = contentsFromCard(card)
    const cardId = idFromCard(card) ?? undefined
    const cardType = typeFromCard(card) ?? undefined

    const victim = extractTaggedValue(text, ['Canonical victim', 'Victim'])
    if (victim) {
      const key = normalizeKey(victim)
      const prev = victimMentions.get(key)
      if (prev) prev.count += 1
      else victimMentions.set(key, { sample: victim, count: 1, cardId, cardType })
    }

    const location = extractTaggedValue(text, ['Canonical location', 'Location'])
    if (location) {
      const key = normalizeKey(location)
      const prev = locationMentions.get(key)
      if (prev) prev.count += 1
      else locationMentions.set(key, { sample: location, count: 1, cardId, cardType })
    }
  }

  for (const [key, mention] of victimMentions.entries()) {
    if (input.knownVictims.has(key)) continue
    input.diagnostics.push({
      level: 'warn',
      message: `Canonical victim "${mention.sample}" does not match any person/character card title (seen in ${mention.count} card(s)).`,
      cardId: mention.cardId,
      cardType: mention.cardType,
      path: 'card_contents',
    })
  }

  for (const [key, mention] of locationMentions.entries()) {
    if (input.knownLocations.has(key)) continue
    input.diagnostics.push({
      level: 'warn',
      message: `Canonical location "${mention.sample}" does not match any location card title (seen in ${mention.count} card(s)).`,
      cardId: mention.cardId,
      cardType: mention.cardType,
      path: 'card_contents',
    })
  }

  if (victimMentions.size > 1) {
    const labels = Array.from(victimMentions.values()).map(v => v.sample).slice(0, 5).join(' | ')
    input.diagnostics.push({
      level: 'warn',
      message: `Multiple canonical victim labels detected: ${labels}${victimMentions.size > 5 ? ' | …' : ''}`,
      path: 'card_contents',
    })
  }

  if (locationMentions.size > 1) {
    const labels = Array.from(locationMentions.values()).map(v => v.sample).slice(0, 5).join(' | ')
    input.diagnostics.push({
      level: 'warn',
      message: `Multiple canonical location labels detected: ${labels}${locationMentions.size > 5 ? ' | …' : ''}`,
      path: 'card_contents',
    })
  }
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
  // Forward-compatible worldbuilding cards (treated as info).
  if (cardType === 'person') return 'info'
  if (cardType === 'location') return 'info'
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

  diagnostics.push({
    level: 'warn',
    message: 'No instruction cards found (expected game_card entries); no synthetic instruction fallback will be injected.',
  })
}

function ensureActPlayable(story: RuntimeStory, diagnostics: AdapterDiagnostic[]) {
  const acts = actsPresent(story)
  for (const act of acts) {
    const hasActContent = story.cards.some(c => c.act === act && (c.intent === 'instruction' || c.intent === 'puzzle'))
    if (hasActContent) continue
    diagnostics.push({
      level: 'warn',
      message: `Act ${act} has no instruction/puzzle content; no synthetic instruction fallback will be injected.`,
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

  const storyTitle = deriveStoryTitle(run, cards)
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
    // Support 'Name — Archetype' or 'Name, Archetype' title patterns.
    // Short name is the display/match key; archetype is pulled from title or explicit field.
    const fullTitle = titleFromCard(card) ?? `Character ${characterId}`
    const emDashIdx = fullTitle.indexOf(' \u2014 ')
    const commaIdx = fullTitle.indexOf(', ')
    const sepIdx = emDashIdx >= 0 ? emDashIdx : commaIdx
    const sepLen = emDashIdx >= 0 ? 3 : 2
    
    const displayName = sepIdx >= 0 ? fullTitle.slice(0, sepIdx).trim() : fullTitle
    const titleArchetype = sepIdx >= 0 ? fullTitle.slice(sepIdx + sepLen).trim() : undefined
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

  const personNames = cards
    .filter(c => typeFromCard(c) === 'person')
    .map(c => titleFromCard(c))
    .filter((v): v is string => Boolean(v))
  const locationNames = cards
    .filter(c => typeFromCard(c) === 'location')
    .map(c => titleFromCard(c))
    .filter((v): v is string => Boolean(v))

  pushNarrativeDriftDiagnostics({
    cards,
    diagnostics,
    knownVictims: new Set([
      ...Object.values(playersByCharacterId).map(p => normalizeKey(p.name)),
      ...Object.values(fullTitleByCharacterId).map(v => normalizeKey(v)),
      ...personNames.map(v => normalizeKey(v)),
    ]),
    knownLocations: new Set(locationNames.map(v => normalizeKey(v))),
  })

  const assignableCharacterIds =
    playerOrder.length > 0 ? playerOrder.slice() : Object.keys(playersByCharacterId)

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
    const linkedId = asString(card.linked_character_id)
    const itemCardId = idFromCard(card)
    let targetId = (linkedName ? characterIdByName[linkedName] : null) ?? linkedId
    let autoAssigned = false

    if (!targetId && assignableCharacterIds.length > 0) {
      const key = itemCardId ?? `${titleFromCard(card) ?? 'item'}:${contentsFromCard(card) ?? ''}`
      targetId = assignableCharacterIds[stableIndex(key, assignableCharacterIds.length)]
      autoAssigned = true
    }
    if (!targetId) continue

    if (!itemCardId) continue

    const act = cardAct(card) ?? 1
    ;(itemsByCharacterId[targetId] ??= []).push({
      id: itemCardId,
      name: titleFromCard(card) ?? 'Unknown Item',
      description: contentsFromCard(card) ?? '',
      act,
      image: imageFromCard(card) ?? undefined,
      locationRef: asString(card.location_ref) ?? null,
    })

    if (autoAssigned) {
      diagnostics.push({
        level: 'warn',
        message: `Item card auto-assigned to character "${playersByCharacterId[targetId]?.name ?? targetId}" because linked_character was missing.`,
        cardId: itemCardId,
        cardType: 'item',
        path: 'linked_character',
      })
    }
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
    let resolvedCharId = linkedCharacterRaw ? characterIdByName[linkedCharacterRaw] : null
    if (!resolvedCharId && cardType === 'item' && assignableCharacterIds.length > 0) {
      resolvedCharId = assignableCharacterIds[stableIndex(cardId, assignableCharacterIds.length)]
    }
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
      image: imageFromCard(card) ?? undefined,
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
        evidenceType: asString(card.evidence_type) ?? null,
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

    if (intent === 'reveal' || cardType === 'solution') {
      const bundleId = asString(card.bundle_id) ?? null
      const hiddenUntilSolved = typeof card.hidden_until_solved === 'boolean' ? card.hidden_until_solved : undefined
      const revealCard = { 
        ...(base as any), 
        intent: 'reveal', 
        bundleId,
        hiddenUntilSolved,
      } as any
      runtimeCards.push(revealCard)

      if (bundleId) {
        const bundle = (bundlesById[bundleId] ??= { id: bundleId, act, cards: [] })
        bundle.cards.push(revealCard)
      }
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
