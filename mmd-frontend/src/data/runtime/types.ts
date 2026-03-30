export type RuntimeCardIntent = 'instruction' | 'clue' | 'info' | 'puzzle' | 'reveal'

export interface RuntimeStage {
  act: number
  title: string
  text: string
  image?: string
}

export interface RuntimeCardBase {
  id: string
  act: number
  intent: RuntimeCardIntent
  title?: string
  text: string
  source: {
    cardType: string
    cardId: string
  }
}

export interface RuntimeInstructionCard extends RuntimeCardBase {
  intent: 'instruction'
  targetCharacterId?: string | null
}

export interface RuntimeClueCard extends RuntimeCardBase {
  intent: 'clue'
}

export interface RuntimeInfoCard extends RuntimeCardBase {
  intent: 'info'
}

export interface RuntimePuzzleCard extends RuntimeCardBase {
  intent: 'puzzle'
  bundleId?: string | null
  hiddenUntilSolved?: boolean
  unlockCardIds?: string[]
  requiredCardIds?: string[]
}

export interface RuntimeRevealCard extends RuntimeCardBase {
  intent: 'reveal'
  bundleId?: string | null
  hiddenUntilSolved?: boolean
}

export type RuntimeCard =
  | RuntimeInstructionCard
  | RuntimeClueCard
  | RuntimeInfoCard
  | RuntimePuzzleCard
  | RuntimeRevealCard

export interface RuntimePlayer {
  characterId: string
  name: string
  archetype?: string
  biography?: string
  secrets: string[]
}

// Phase 2. Present for contract stability, but intentionally not surfaced in MVP UI.
export interface RuntimeBundle {
  id: string
  act: number
  cards: RuntimeCard[]
  requiredCardIds?: string[]
  unlockCardIds?: string[]
}

export interface RuntimeStory {
  id: string
  title: string
  summary: string
  playerCount: number
  playerOrder: string[]
  stageByAct: Record<number, RuntimeStage>
  playersByCharacterId: Record<string, RuntimePlayer>
  cards: RuntimeCard[]
  bundles: RuntimeBundle[]
}

