# MMD App Design (Front + Back)

## Purpose
This document describes the local architecture for the **Murder Mystery Dinner (MMD)** game:
- **Front end** (React/Vite) renders screens for three roles: `launcher`, `host`, and `player`.
- **Back end** (Fastify/Prisma) provides a host-controlled game engine with act-gated story content.

The current MVP is intentionally simple: the UI is wired to the back end for game creation, host control, joining, and act/state-driven content visibility. Some “room messaging” concepts exist in the UI, but they are not fully persisted yet.

## System Overview
### Backend (Fastify + Prisma)
- Server is created in `mmd-api/src/index.ts`
- Routes are mounted under `'/api/v1'`:
  - `stories` (static templates)
  - `games` (host runtime + stage/state transitions)
  - `players` (player join + player read-only view)
- Persistence is SQLite via Prisma (`mmd-api/prisma/schema.prisma`)

### Frontend (React + Vite)
- Entry is `mmd-frontend/src/main.tsx` and the main component is `mmd-frontend/src/App.tsx`
- App mode is inferred from the URL path:
  - `/` (launcher)
  - `/host/:gameId` (host)
  - `/play/:gameId/:characterId` (player)
- A declarative page system renders screens from a schema:
  - `PageRenderer` + `RenderNode` (from `mmd-frontend/src/components/`)
  - UI primitives live in `Primitives.tsx`
- Data fetching + polling lives in `mmd-frontend/src/hooks/useAppState.ts`
- API calls are centralized in `mmd-frontend/src/data/api.ts`
- The API payload -> UI model adapter is `mmd-frontend/src/data/adapters.ts`

## Backend API Shapes (Main Contracts)
All API endpoints are versioned under:
- `/api/v1/*`

### Story Templates
1. `GET /api/v1/stories`
   - Response: `StoryListItem[]`
   - Fields: `id`, `title`, `summary`, `createdAt`

2. `GET /api/v1/stories/:id`
   - Response: full `Story`
   - Includes `dataJson` (characters, acts, mysteries, puzzles, cards, etc.)

### Game Sessions (Host Runtime)
1. `POST /api/v1/games`
   - Body: `CreateGameBodySchema`
     - `storyId`, `name`, `scheduledTime` (ISO), `locationText?`
   - Response: `GameHostViewSchema`
     - Includes `hostKey` and `players[]`
     - Player “character name” is derived from the story JSON

2. `GET /api/v1/games`
   - Response: array of summarized `Game`
   - Fields: state, currentAct, scheduledTime, etc. (dates serialized as strings)

3. `GET /api/v1/games/:id/host` (host read)
   - Header: `x-host-key: <hostKey>`
   - Response: `GameHostViewSchema`
   - Used by the host screen to show the current state, room players, and host actions

4. Host state transitions (host write, header required):
   - `POST /api/v1/games/:id/host/start`
     - Requires game state `SCHEDULED`
     - Sets `state` to `PLAYING` and initializes `currentAct = 1` + `startedAt`
   - `POST /api/v1/games/:id/host/next-act`
     - Requires game state `PLAYING`
     - Increments `currentAct` until final act (guarded in handler)
   - `POST /api/v1/games/:id/host/end-night`
     - Requires game state `PLAYING`
     - Body: `SubmitAnswersBodySchema` = `{ who, how, why }`
     - Sets `state` to `REVEAL`
     - Upserts `GameMysteryAnswer` for each track (`who|how|why`)
   - `POST /api/v1/games/:id/host/done`
     - Requires game state `REVEAL`
     - Sets `state` to `DONE`

5. `POST /api/v1/games/:id/players/:playerId/assign`
   - Header required: `x-host-key`
   - Body: `AssignCharacterBodySchema` = `{ characterId }`
   - Used to assign which story character a specific player slot represents

### Player Join + Player Read
1. Join:
   - `POST /api/v1/play/:gameId/:loginKey/join`
     - Body: `JoinGameBodySchema` = `{ playerName }`
   - `POST /api/v1/play/:gameId/character/:characterId/join`
     - Body: `{ playerName }`

2. Player read (polling):
   - `GET /api/v1/play/:gameId/:loginKey`
   - `GET /api/v1/play/:gameId/character/:characterId`
   - Response: `PlayerViewSchema`
     - Includes unlocked mysteries/puzzles/cards (act-gated)
     - Includes `mysteryAnswers` only once the game is in `REVEAL`

## Frontend UI Components (What Exists Today)
### Role-aware screens (schema-driven)
The app chooses a `PageSchema` based on mode:
- Launcher:
  - `launcherPageSchema`
  - layout: `launcher` -> renders `LauncherCard`
- Player entry (pre-join):
  - `joinPageSchema`
  - layout: `stage` + `join-card` -> `JoinCard`
- Player game (post-join):
  - `playerPageSchema`
  - tabs: `game | objectives | profile`
  - layout sections:
    - `stage`, `feed`, `composer` under `game`
    - objectives lists under `objectives`
    - `ProfileCard` + lists under `profile`
- Host:
  - `hostPageSchema` extends the player schema by adding:
    - host-only `host-info` section
    - host-only actions `actions` (start/next-act/end-night/finish)
    - host objective list

### Rendering pipeline
1. `App.tsx`
   - Computes `mode` + selects `schema`
   - Determines whether the player tabs should be shown (`player.joined` gating)
2. `PageRenderer`
   - Looks up schema layouts by `activeTab`
3. `RenderNode` (in `Primitives.tsx`)
   - Switches on node type:
     - `stage`, `feed`, `section`, `list`, `actions`, `profile-card`, `host-info`, `composer`, `launcher`, `join-card`
4. UI primitives:
   - `Stage`: shows stage text, countdown, banner, and players pills
   - `Feed`: renders “room feed” items (currently built by adapters + reveal announcements)
   - `ObjectiveList`: renders objective rows with click-to-toggle (host and local UI behavior)
   - `ActionsBar`: renders host action buttons and calls handlers
   - `ProfileCard`: displays biography/archetype
   - `HostInfoCard`: displays game info + copyable player links
   - `ComposerCard`: UI for messages (persistence mocked/unwired)
   - `LauncherCard` / `JoinCard`: pre-game configuration and joining

## Game Flow (End-to-End Loop)
### 1. Launcher
User selects a story template and configures:
- `storyId`
- `name`
- `scheduledTime`
- `locationText?`

Launcher calls:
- `GET /api/v1/stories` to populate story list
- `POST /api/v1/games` to create a game

Response includes:
- `hostKey`
- `playerLinks[]` containing URLs for each story character slot

### 2. Host Lobby -> Start
Host opens:
- `/host/:gameId?hostKey=...&api=...`

Host screen:
- polls `GET /api/v1/games/:id/host` every ~5 seconds
- shows `SCHEDULED` state with countdown until the agreed time
- host can trigger `POST /api/v1/games/:id/host/start`

Host transitions:
- `SCHEDULED` -> `PLAYING` (`currentAct = 1`)

### 3. Act Progression
While `state = PLAYING`:
- host screen polls host view and shows `Next Act` + `End Night`
- host calls `POST /host/next-act` to increment `currentAct`

Player act-gating:
- player read endpoint supplies act-filtered:
  - unlocked mysteries
  - unlocked puzzles
  - unlocked cards

### 4. Reveal
When host calls:
- `POST /api/v1/games/:id/host/end-night` with `{who, how, why}`

Backend sets:
- `state = REVEAL`
- stores `GameMysteryAnswer` per track

Player view behavior:
- player read endpoint includes `mysteryAnswers` only in `REVEAL`
- UI adapter converts answers into “reveal” feed items and updates stage banner/text

### 5. Done
Host calls:
- `POST /api/v1/games/:id/host/done`

Backend sets:
- `state = DONE`

The UI currently treats non-`SCHEDULED` and non-`REVEAL` states as “live game” in stage text, so `DONE` is mainly a state marker for future UX refinement.

## System Design Notes (Key Mechanics)
### State machine
The entire runtime is governed by:
- `SCHEDULED -> PLAYING -> REVEAL -> DONE`

### Act-gating
Act gating is the core unlock mechanic:
- story items in `dataJson` may include optional `act`
- `filterByAct` logic:
  - defaults to visible from act 1 when `act` is missing
  - hides items when `item.act > currentAct`
- server uses this when building `PlayerViewSchema`

### Security model (keys, not accounts)
- Host authentication is “shared secret” style:
  - host key is generated at game creation
  - host actions require `x-host-key` header
- Player “auth” is embedded in the URL:
  - login tokens live in `game_players.loginKey`
  - join and read access rely on those path parameters

## File/Module Map (Where to Look)
Backend:
- `mmd-api/src/index.ts` (server + route mounting)
- `mmd-api/src/routes/stories.ts`
- `mmd-api/src/routes/games.ts`
- `mmd-api/src/routes/players.ts`
- `mmd-api/src/schemas/index.ts` (Zod shapes)
- `mmd-api/src/lib/actGating.ts` (unlock mechanics)
- `mmd-api/prisma/schema.prisma` (persistence models)

Frontend:
- `mmd-frontend/src/App.tsx` (mode selection + schema selection)
- `mmd-frontend/src/hooks/useAppState.ts` (data fetching + polling)
- `mmd-frontend/src/data/api.ts` (HTTP client functions)
- `mmd-frontend/src/data/adapters.ts` (API -> ScreenData mapping)
- `mmd-frontend/src/components/PageRenderer.tsx`
- `mmd-frontend/src/components/Primitives.tsx`
- `mmd-frontend/src/schemas/pages.ts` (page schemas)

