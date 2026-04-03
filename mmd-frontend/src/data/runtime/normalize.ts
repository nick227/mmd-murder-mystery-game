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
