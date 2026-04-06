export type GameState = 'SCHEDULED' | 'PLAYING' | 'REVEAL' | 'DONE' | 'CANCELLED'
export type TabId = 'lobby' | 'game' | 'profile'
export type ViewMode = 'launcher' | 'host' | 'room' | 'play'
export type FeedItemType = 'chat' | 'announcement' | 'system'
export type FeedVariant = 'narration' | 'social' | 'mechanic' | 'room'

export type MoveType = 'suspect' | 'accuse' | 'alibi' | 'share_clue' | 'searched' | 'solved'

export type MediaKind = 'image' | 'video' | 'audio'
export type MediaRatio = '16:9' | '4:3' | '1:1' | 'auto'
export type MediaVariant = 'hero' | 'card' | 'thumb'
export type MediaFallbackType = 'gradient' | 'initials' | 'icon'
export type MediaFit = 'cover' | 'contain'
export type MediaRole = 'decorative' | 'content' | 'avatar'

export type MediaProps = {
  kind?: MediaKind
  src?: string
  poster?: string
  alt?: string
  ratio?: MediaRatio
  variant?: MediaVariant
  fit?: MediaFit
  priority?: boolean
  sizes?: string
  role?: MediaRole
  onClick?: () => void
  fallback?: {
    type: MediaFallbackType
    label?: string
  }
}

export interface RoomPlayer {
  id: string
  name: string
  joinedName?: string
  characterId: string
  online: boolean
  portrait?: string
}

export interface StageData {
  state: GameState
  act: number
  title: string
  /** Game instance name (shown in app header). */
  subtitle: string
  /** Host display name (player lobby header). */
  hostName?: string | null
  /** Game location (player lobby header). */
  locationText?: string | null
  /** Story title (shown inside the stage "story area"). */
  storyTitle?: string
  /** ISO datetime for scheduled start (if scheduled). */
  scheduledTime?: string
  description: string
  storyBlurb?: string
  actText?: string
  storyImage?: string
  image?: string
  countdownLabel?: string
  countdownPercent?: number
  banner?: string
}

export interface FeedItem {
  id: string
  type: FeedItemType
  variant?: FeedVariant
  media?: MediaProps
  layout?: 'row' | 'cinematic'
  stacking?: 'solo' | 'start' | 'mid' | 'end'
  actDivider?: number
  chips?: Array<{
    kind: 'clue' | 'location'
    id?: string
    label: string
    image?: string
  }>
  title?: string
  body?: string
  text: string
  author?: string
  authorPortrait?: string
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

export interface EvidenceItem {
  id: string
  kind: 'clue' | 'puzzle' | 'reveal' | 'item' | 'treasure' | 'info'
  title: string
  text: string
  act?: number
  image?: string
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

export interface ComposerEvidenceOption {
  id: string
  label: string
  image?: string
}

export interface ComposerData {
  mode: 'public' | 'private'
  draft: string
  placeholder?: string
  recipients: ComposerRecipient[]
  canSend?: boolean
}

export interface PostMovePayload {
  type: 'POST_MOVE'
  text: string
  clientRequestId: string
  characterId: string
  characterName: string
  characterPortrait?: string
}

export interface StoryListItem {
  id: string
  title: string
  summary: string
  image?: string
  characters?: Array<{
    characterId: string
    name: string
    archetype?: string
    portrait?: string
  }>
  createdAt?: string
}

export interface CreateGameFormData {
  apiBase: string
  storyId: string
  name: string
  scheduledTime: string
  locationText: string
}

export type StoredGameLink = {
  gameId: string
  apiBase: string
  hostKey?: string
  characterIds: string[]
  /** Optional story metadata so history can render rich cards across API bases. */
  story?: {
    id?: string | null
    title?: string
    summary?: string
    image?: string
  }
  lastSeenAt: string
}

export interface LauncherData {
  apiBase: string
  stories: StoryListItem[]
  form: CreateGameFormData
  allGames: ApiGameSummary[]
  activeGamePublic?: ApiPublicGameView | null
  activeGamePublicKey?: string | null
  loadingMore?: boolean
  hasMoreGames?: boolean
  createdGame?: {
    id: string
    name: string
    creatorUserId?: string | null
    creatorName?: string | null
    creatorAvatar?: string | null
    hostKey: string
    scheduledTime: string
    hostUrl: string
    playerLinks: Array<{ characterId: string; label: string; url: string }>
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
  view?: {
    doNow: ObjectiveItem[]
    evidence: EvidenceItem[]
  }
  objectives: {
    personal: ObjectiveItem[]
    group: ObjectiveItem[]
    /** Story reveal cards (Cards tab only; not duplicated on Character). */
    reveals: ObjectiveItem[]
    host?: ObjectiveItem[]
  }
  profile: {
    characterName: string
    archetype?: string
    biography?: string
    portrait?: string
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
  onObjectiveSubmit?: (objectiveId: string) => Promise<void>
  onComposerModeChange?: (mode: 'public' | 'private') => void
  onComposerDraftChange?: (value: string) => void
  onComposerSend?: (text: string) => void
  onCopyText?: (value: string) => void
  onLauncherOpenGameDetails?: (gameId: string, apiBase: string) => void
  onLauncherSubmitGame?: (input: {
    mode: 'create' | 'edit'
    apiBase: string
    storyId: string
    name: string
    scheduledTime: string
    locationText: string
    characterId: string
    gameId?: string
    hostKey?: string
  }) => Promise<void>
  onCancelGame?: (gameId: string, hostKey: string) => Promise<void>
  onRescheduleGame?: (gameId: string, hostKey: string, scheduledTime: string) => Promise<void>
  onJoinNameChange?: (value: string) => void
  onJoinSubmit?: () => void
  onLoadMoreGames?: () => Promise<void>
}

export interface ApiGameEvent {
  id: string
  gameId?: string
  playerId?: string | null
  type:
    | 'SYSTEM'
    | 'ACT_CHANGED'
    | 'ANNOUNCEMENT'
    | 'STAGE_UPDATED'
    | 'JOIN'
    | 'SUBMIT_OBJECTIVE'
    | 'POST_MOVE'
    | 'START_GAME'
    | 'ADVANCE_ACT'
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
  characterName?: string | null
  portrait?: string | null
  playerName: string | null
  joinedAt: string | null
}

export interface HostApiGamePlayer {
  id: string
  characterId: string
  characterName?: string | null
  portrait?: string | null
  playerName: string | null
  loginKey: string
  joinedAt: string | null
}

export interface HostApiGame {
  id: string
  storyId: string
  name: string
  storyTitle?: string
  creatorUserId?: string | null
  creatorName?: string | null
  creatorAvatar?: string | null
  hostKey: string
  scheduledTime: string
  startedAt: string | null
  state: GameState
  currentAct: number
  maxAct: number
  locationText: string | null
  stageTitle?: string | null
  stageText?: string | null
  stageImage?: string | null
  createdAt: string
  updatedAt: string
  players: HostApiGamePlayer[]
  feed?: ApiGameEvent[]
}

export interface ApiGameSummary {
  id: string
  storyId: string | null
  storyFile?: string | null
  name: string
  creatorUserId?: string | null
  creatorName?: string | null
  creatorAvatar?: string | null
  scheduledTime: string
  startedAt: string | null
  state: GameState
  currentAct: number
  locationText: string | null
  createdAt: string
  updatedAt: string
  hostKey?: string
  joinedCharacters?: Array<{ characterId: string; characterName: string | null }>
}

export interface ApiPublicGameView {
  gameId: string
  gameName: string
  gameState: GameState
  creatorUserId?: string | null
  creatorName?: string | null
  creatorAvatar?: string | null
  scheduledTime: string
  locationText: string | null
  story: {
    id: string
    title: string
    summary: string
    image?: string | null
    characters: Array<{
      characterId: string
      name: string
      archetype?: string
      portrait?: string
      joined?: boolean
    }>
  }
}

export interface PlayerApiView {
  gameId: string
  gameName: string
  creatorName?: string | null
  storyTitle?: string
  storyBlurb?: string
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
  visibleInfoCards?: Array<Record<string, unknown>>
  visibleItems?: Array<Record<string, unknown>>
  visibleHostSpeech?: Array<Record<string, unknown>>
  visibleTreasures?: Array<Record<string, unknown>>
  unlockedMysteries: Array<Record<string, unknown>>
  unlockedPuzzles: Array<Record<string, unknown>>
  unlockedCards: Array<Record<string, unknown>>
  mysteryAnswers?: Array<{ track: 'who' | 'how' | 'why'; answer: string }>
  storyImage?: string | null
}
