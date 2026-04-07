# Client Data Reference

This document describes the inbound story and game payloads consumed by the client. It mirrors the canonical types in `mmd-frontend/src/data/types.ts` and the API schemas in `mmd-api/src/schemas/index.ts`.

## Conventions
- Timestamps are ISO 8601 strings.
- Optional fields may be omitted or `null` as noted.
- `Record<string, unknown>` indicates a free-form blob that the client passes through or renders generically.

## Enums

### GameState
`'SCHEDULED' | 'PLAYING' | 'REVEAL' | 'DONE' | 'CANCELLED'`

### ApiGameEvent.type
`'SYSTEM' | 'ACT_CHANGED' | 'ANNOUNCEMENT' | 'STAGE_UPDATED' | 'JOIN' | 'SUBMIT_OBJECTIVE' | 'POST_MOVE' | 'START_GAME' | 'ADVANCE_ACT'`

## Story Objects

### StoryListItem
Used by `GET /api/v1/stories`.

```ts
interface StoryListItem {
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
```

### Story (StorySchema)
Used by `GET /api/v1/stories/:id`.

```ts
interface Story {
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
  createdAt: string
  updatedAt: string
  dataJson: unknown
}
```

## Game Objects

### ApiGameEvent
Used inside host and player game payloads.

```ts
interface ApiGameEvent {
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
```

### ApiStage
Represents the current stage card shown to players.

```ts
interface ApiStage {
  title?: string
  text?: string
  image?: string
}
```

### ApiRoomPlayer
Used in `PlayerApiView.roomPlayers`.

```ts
interface ApiRoomPlayer {
  id: string
  characterId: string
  characterName?: string | null
  portrait?: string | null
  playerName: string | null
  joinedAt: string | null
}
```

### HostApiGamePlayer
Used in `HostApiGame.players`.

```ts
interface HostApiGamePlayer {
  id: string
  characterId: string
  characterName?: string | null
  portrait?: string | null
  playerName: string | null
  loginKey: string
  joinedAt: string | null
}
```

### ApiGameSummary
Used by `GET /api/v1/games` and `GET /api/v1/my/games`.

```ts
interface ApiGameSummary {
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
```

### ApiPublicGameView
Used by `GET /api/v1/games/:id/public`.

```ts
interface ApiPublicGameView {
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
```

### HostApiGame
Used by `GET /api/v1/games/:id/host` and `POST /api/v1/games` (create).

```ts
interface HostApiGame {
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
```

### PlayerApiView
Used by `GET /api/v1/play/:gameId/character/:characterId`.

```ts
interface PlayerApiView {
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
  storyImage?: string | null
}
```

## Notes
- `Story.dataJson` is the raw generated story JSON blob. Its internal schema is not enforced on the client; use the runtime adapters for normalization.
- `ApiGameEvent.payload` is event-specific and should be treated as opaque unless a mapper explicitly handles a given `type`.
