import type { ActionItem, EvidenceItem, FeedItem, ObjectiveItem, RendererHandlers, RoomPlayer, ScreenData, StageData } from '../../../data/types'

export type PlayerLobbyTemplateProps = {
  stage: StageData
  players: RoomPlayer[]
  feed: FeedItem[]
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
}

export type PlayerProfileTemplateProps = {
  profile: ScreenData['profile']
}
