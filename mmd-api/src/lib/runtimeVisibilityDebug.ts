import type { GameState } from './runtimeToApi.js'
import type { RuntimeBundle, RuntimeCard, RuntimeItem } from './runtimeStory.js'

function countByIntent(cards: RuntimeCard[]): Record<string, number> {
  const out: Record<string, number> = {}
  for (const c of cards) out[c.intent] = (out[c.intent] ?? 0) + 1
  return out
}

function countRevealCardsInBundles(bundles: RuntimeBundle[]): number {
  let count = 0
  for (const b of bundles) {
    for (const c of b.cards) {
      if (c.intent === 'reveal') count++
    }
  }
  return count
}

function uniqueActs(cards: Array<{ act: number }>): number[] {
  const acts = new Set<number>()
  for (const c of cards) acts.add(c.act)
  return Array.from(acts).sort((a, b) => a - b)
}

export function runtimeVisibilityDebug(input: {
  enabled?: boolean
  gameId: string
  state: GameState
  currentAct: number
  solvedActs: number[]
  storyCards: RuntimeCard[]
  bundles: RuntimeBundle[]
  visibleClues: RuntimeCard[]
  visiblePuzzles: RuntimeCard[]
  visibleReveals: RuntimeCard[]
  visibleHostSpeech: RuntimeCard[]
  visibleTreasures: RuntimeCard[]
  visibleInfoCards: RuntimeCard[]
  visibleItems: RuntimeItem[]
  returnedSecretsCount: number
}) {
  const enabled =
    input.enabled
      ?? (process.env.NODE_ENV !== 'production' && process.env.MMD_VIS_DEBUG !== '0')
  if (!enabled) return

  const prefix = `[visibility] game=${input.gameId} state=${input.state} act=${input.currentAct}`
  const intents = countByIntent(input.storyCards)
  const storyRevealActs = uniqueActs(input.storyCards.filter(c => c.intent === 'reveal'))
  const visibleRevealActs = uniqueActs(input.visibleReveals)
  const bundleRevealCount = countRevealCardsInBundles(input.bundles)

  console.info(prefix, {
    story: {
      totalCards: input.storyCards.length,
      intents,
      bundles: input.bundles.length,
      bundleRevealCount,
      storyRevealActs,
    },
    visible: {
      clues: input.visibleClues.length,
      puzzles: input.visiblePuzzles.length,
      reveals: input.visibleReveals.length,
      revealActs: visibleRevealActs,
      hostSpeech: input.visibleHostSpeech.length,
      treasures: input.visibleTreasures.length,
      info: input.visibleInfoCards.length,
      items: input.visibleItems.length,
      secrets: input.returnedSecretsCount,
    },
    solvedActs: input.solvedActs,
  })

  const warn = (message: string, extra?: Record<string, unknown>) => {
    console.warn(prefix, message, extra ?? {})
  }

  if (input.state === 'SCHEDULED') {
    if (input.returnedSecretsCount <= 0) warn('SCHEDULED expected secrets > 0')
    if (input.visibleHostSpeech.length !== 1) warn('SCHEDULED expected host_speech = 1', { hostSpeech: input.visibleHostSpeech.length })
    if (input.visibleClues.length !== 0) warn('SCHEDULED expected clues = 0', { clues: input.visibleClues.length })
    if (input.visiblePuzzles.length !== 0) warn('SCHEDULED expected puzzles = 0', { puzzles: input.visiblePuzzles.length })
    if (input.visibleReveals.length !== 0) warn('SCHEDULED expected reveals = 0', { reveals: input.visibleReveals.length })
  }

  if (input.state === 'PLAYING') {
    if (input.visibleClues.length < 1) warn('PLAYING expected clues >= 1')
    if (input.visiblePuzzles.length < 1) warn('PLAYING expected puzzles >= 1')
    if (input.returnedSecretsCount !== 0) warn('PLAYING expected secrets = 0', { secrets: input.returnedSecretsCount })

    const solvedSet = new Set(input.solvedActs)
    const unsolvedReveal = input.visibleReveals.find(r => !solvedSet.has(r.act))
    if (unsolvedReveal) {
      warn('PLAYING reveal card visible for unsolved act (spoiler leak)', { cardId: unsolvedReveal.id, act: unsolvedReveal.act })
    }

    // Optional sanity: when there are solved acts with reveal cards, expect to see at least one reveal.
    const hasSolvedReveal =
      storyRevealActs.some(act => solvedSet.has(act) && act <= input.currentAct)
    if (hasSolvedReveal && input.visibleReveals.length === 0) {
      warn('PLAYING expected some reveals for solvedActs, but reveals=0', { storyRevealActs, solvedActs: input.solvedActs })
    }
  }

  if (input.state === 'REVEAL') {
    if (input.visibleReveals.length <= 0) warn('REVEAL expected reveals > 0')
    if (input.returnedSecretsCount !== 0) warn('REVEAL expected secrets = 0', { secrets: input.returnedSecretsCount })

    // "All bundles expanded" check: ensure all bundled reveal cards are visible.
    if (bundleRevealCount > input.visibleReveals.length) {
      warn('REVEAL expected all bundled reveals visible (bundleRevealCount > visibleReveals)', {
        bundleRevealCount,
        visibleReveals: input.visibleReveals.length,
      })
    }
  }

  if (input.state === 'DONE') {
    const everythingCount =
      input.visibleClues.length
      + input.visiblePuzzles.length
      + input.visibleReveals.length
      + input.visibleHostSpeech.length
      + input.visibleTreasures.length
      + input.visibleInfoCards.length
      + input.visibleItems.length

    if (everythingCount <= 0) warn('DONE expected everything > 0', { everythingCount })
    if (input.returnedSecretsCount <= 0) warn('DONE expected secrets > 0')
  }
}

