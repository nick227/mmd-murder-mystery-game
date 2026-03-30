export type GameState = 'SCHEDULED' | 'PLAYING' | 'REVEAL' | 'DONE'
export type TabId = 'game' | 'objectives' | 'profile'
export type ViewMode = 'launcher' | 'player' | 'host'
export type FeedItemType = 'chat' | 'announcement' | 'system'

export interface RoomPlayer {
  id: string
  name: string
  characterId: string
  online: boolean
}

export interface StageData {
  state: GameState
  act: number
  title: string
  subtitle: string
  description: string
  image?: string
  countdownLabel?: string
  countdownPercent?: number
  banner?: string
}

export interface FeedItem {
  id: string
  type: FeedItemType
  text: string
  author?: string
  visibility?: 'public' | 'private'
  recipientName?: string
  timestamp?: string
}

export interface ObjectiveItem {
  id: string
  text: string
  completed: boolean
  group?: boolean
  act?: number
  intent?: 'instruction' | 'clue' | 'puzzle' | 'reveal' | 'info'
}

export interface ProfileCardItem {
  id: string
  label: string
  value: string
}

export interface ActionItem {
  id: string
  label: string
  kind?: 'primary' | 'secondary' | 'danger'
  disabled?: boolean
}

export interface ComposerRecipient {
  id: string
  label: string
}

export interface ComposerData {
  mode: 'public' | 'private'
  draft: string
  placeholder?: string
  recipients: ComposerRecipient[]
  recipientId?: string
  canSend?: boolean
}

export interface StoryListItem {
  id: string
  title: string
  summary: string
  createdAt?: string
}

export interface CreateGameFormData {
  apiBase: string
  storyId: string
  name: string
  scheduledTime: string
  locationText: string
}

export interface LauncherData {
  apiBase: string
  stories: StoryListItem[]
  form: CreateGameFormData
  createdGame?: {
    id: string
    name: string
    hostKey: string
    hostUrl: string
    playerLinks: Array<{ label: string; url: string }>
  }
}

export interface JoinData {
  title: string
  subtitle: string
  playerName: string
  submitLabel: string
}

export interface ScreenData {
  game: StageData
  players: RoomPlayer[]
  feed: FeedItem[]
  objectives: {
    personal: ObjectiveItem[]
    group: ObjectiveItem[]
    host?: ObjectiveItem[]
  }
  profile: {
    characterName: string
    archetype?: string
    biography?: string
    secrets: ProfileCardItem[]
    items: ProfileCardItem[]
    cards: ProfileCardItem[]
  }
  composer: ComposerData
  gameActions: ActionItem[]
  hostInfo?: {
    gameId: string
    storyTitle: string
    scheduledTime: string
    locationText?: string | null
    hostKey: string
    playerLinks: Array<{ characterId: string; label: string; url: string; joined: boolean }>
  }
  launcher?: LauncherData
  join?: JoinData
}

export interface LayoutNode {
  id: string
  type:
    | 'stage'
    | 'feed'
    | 'section'
    | 'list'
    | 'profile-card'
    | 'actions'
    | 'host-info'
    | 'composer'
    | 'launcher'
    | 'join-card'
  bind?: string
  title?: string
  emptyText?: string
  children?: LayoutNode[]
}

export interface TabSchema {
  id: TabId
  label: string
}

export interface PageSchema {
  id: string
  tabs?: TabSchema[]
  layouts: Record<string, LayoutNode[]>
}

export interface RendererHandlers {
  onAction?: (actionId: string) => void
  onObjectiveToggle?: (objectiveId: string) => void
  onComposerModeChange?: (mode: 'public' | 'private') => void
  onComposerRecipientChange?: (recipientId: string) => void
  onComposerDraftChange?: (value: string) => void
  onComposerSend?: () => void
  onCopyText?: (value: string) => void
  onLauncherFieldChange?: (field: keyof CreateGameFormData | 'apiBase', value: string) => void
  onCreateGame?: () => void
  onJoinNameChange?: (value: string) => void
  onJoinSubmit?: () => void
}

export interface ApiGameEvent {
  id: string
  gameId?: string
  playerId?: string | null
  type: 'SYSTEM' | 'ACT_CHANGED' | 'ANNOUNCEMENT' | 'STAGE_UPDATED'
  payload?: Record<string, unknown>
  createdAt?: string
}

export interface ApiStage {
  title?: string
  text?: string
  image?: string
}

export interface ApiRoomPlayer {
  id: string
  characterId: string
  playerName: string | null
  joinedAt: string | null
}

export interface HostApiGamePlayer {
  id: string
  characterId: string
  characterName?: string | null
  playerName: string | null
  loginKey: string
  joinedAt: string | null
}

export interface HostApiGame {
  id: string
  storyId: string
  name: string
  storyTitle?: string
  hostKey: string
  scheduledTime: string
  startedAt: string | null
  state: GameState
  currentAct: number
  locationText: string | null
  stageTitle?: string | null
  stageText?: string | null
  stageImage?: string | null
  createdAt: string
  updatedAt: string
  players: HostApiGamePlayer[]
  feed?: ApiGameEvent[]
}

export interface PlayerApiView {
  gameId: string
  gameName: string
  gameState: GameState
  currentAct: number
  scheduledTime: string
  locationText: string | null
  stage?: ApiStage | null
  roomPlayers?: ApiRoomPlayer[]
  feed?: ApiGameEvent[]
  playerId: string
  characterId: string
  playerName: string | null
  character: Record<string, unknown> | null
  unlockedMysteries: Array<Record<string, unknown>>
  unlockedPuzzles: Array<Record<string, unknown>>
  unlockedCards: Array<Record<string, unknown>>
  mysteryAnswers?: Array<{ track: 'who' | 'how' | 'why'; answer: string }>
}
