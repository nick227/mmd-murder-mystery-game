import type { ActionItem, EvidenceItem, FeedItem, ObjectiveItem, RendererHandlers, RoomPlayer, ScreenData, StageData } from '../../../data/types'

export type PlayerLobbyTemplateProps = {
  stage: StageData
  players: RoomPlayer[]
  feed: FeedItem[]
  profile: ScreenData['profile']
  doNow: ObjectiveItem[]
  evidence: EvidenceItem[]
  gameState: ScreenData['game']['state']
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

export type PlayerProfileTemplateProps = {
  profile: ScreenData['profile']
  /** Render as a section inside lobby (`surface--profile`) instead of a full-screen `main`. */
  embedded?: boolean
}
