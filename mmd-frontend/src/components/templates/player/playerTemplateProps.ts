import type { ActionItem, EvidenceItem, FeedItem, ObjectiveItem, RendererHandlers, RoomPlayer, ScreenData, StageData } from '../../../data/types'

export type PlayerLobbyTemplateProps = {
  stage: StageData
  players: RoomPlayer[]
  feed: FeedItem[]
  profile: ScreenData['profile']
  statusLine: string
  join?: ScreenData['join']
  joined?: boolean
  currentCharacterId?: string | null
  composer?: ScreenData['composer']
  handlers?: RendererHandlers
  hostActions?: ActionItem[]
  hostHandlers?: RendererHandlers
  hostError?: string
}

export type PlayerGameTemplateProps = {
  stage: StageData
  players: RoomPlayer[]
  doNow: ObjectiveItem[]
  evidence: EvidenceItem[]
  handlers?: RendererHandlers
  /** Game state to control visibility of content. */
  gameState?: ScreenData['game']['state']
}

export type PlayerProfileTemplateProps = {
  profile: ScreenData['profile']
  /** Render as a section inside lobby (`surface--profile`) instead of a full-screen `main`. */
  embedded?: boolean
}
