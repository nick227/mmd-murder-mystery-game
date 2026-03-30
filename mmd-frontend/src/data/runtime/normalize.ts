import type { AdapterDiagnostic } from '../adapters/generatedStoryAdapter'
import type { RuntimeCard, RuntimeStory } from './types'

function stableLocalId(input: string): string {
  let hash = 2166136261
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i)
    hash = Math.imul(hash, 16777619)
  }
  return `local-${(hash >>> 0).toString(16)}`
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
    text: 'A reveal becomes available after you submit an objective.',
    source: { cardType: 'synthetic', cardId: 'fallback-reveal' },
    hiddenUntilSolved: true,
    bundleId: null,
  } as RuntimeCard)
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
    } as RuntimeCard)
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
  } as RuntimeCard)
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
    } as RuntimeCard)
  }
}

export function normalizeRuntimeStory(input: RuntimeStory, diagnostics: AdapterDiagnostic[]): RuntimeStory {
  const story: RuntimeStory = {
    ...input,
    stageByAct: { ...input.stageByAct },
    playersByCharacterId: { ...input.playersByCharacterId },
    cards: input.cards.slice(),
    bundles: input.bundles.slice(),
    playerOrder: input.playerOrder.slice(),
  }

  if (!story.playerOrder.length) {
    story.playerOrder = Object.keys(story.playersByCharacterId)
  }

  ensurePlayerObjective(story, diagnostics)
  ensureRevealExists(story, diagnostics)
  ensureActPlayable(story, diagnostics)

  return story
}

