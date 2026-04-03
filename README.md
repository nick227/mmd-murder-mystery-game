![Alt text](https://pub-9c79c8328d194e7eb1e10f856c145b3d.r2.dev/dezgo_3d28f3918e9da323.jpg)

# MMD — Murder Mystery Dinner Game

Host a murder mystery dinner with a lightweight “game master” console and player dashboards. The host controls pacing (acts + reveal), and players get character-specific info that unlocks over time.

## What you can do right now
- **Create a game** from a story template (launcher)
- **Share one link per character** to guests
- **Run the night** as host: start the game, advance acts, end night + reveal answers
- **Join as a player** and see act-gated cards/puzzles/mysteries as the host advances

## How the game works (high-level)
- **Roles**
  - **Launcher**: creates the game and generates links
  - **Host**: controls state transitions and pacing
  - **Player**: read-only view of their character + unlocked content
- **State machine**
  - `SCHEDULED → PLAYING → REVEAL → DONE`
- **Act gating (unlock mechanic)**
  - Story content (cards, puzzles, mysteries) may include an `act` number
  - Players can only see items where `act <= currentAct`

## App structure
- **Backend**: `mmd-api/` (Fastify + Prisma)
  - API prefix: `/api/v1`
  - OpenAPI docs: `/docs`
  - Health: `/health`
- **Frontend**: `mmd-frontend/` (React + Vite)
  - One SPA with three modes: launcher / host / player
  - UI is schema-driven (page schemas → renderer → primitives)
- **Design deep dive**
  - See `docs/plans/2026-03-30-mmd-app-design.md`

## API at a glance
**Stories**
- `GET /api/v1/stories` (list story templates)
- `GET /api/v1/stories/:id` (full story blob)

**Games (host runtime)**
- `POST /api/v1/games` (create game; returns `hostKey` + player links)
- `GET /api/v1/games/:id/host` (host view; requires `x-host-key`)
- `POST /api/v1/games/:id/host/start`
- `POST /api/v1/games/:id/host/next-act`
- `POST /api/v1/games/:id/host/end-night` (submit `{who, how, why}`; moves to `REVEAL`)
- `POST /api/v1/games/:id/host/done`

**Players**
- `POST /api/v1/play/:gameId/character/:characterId/join` (set player name)
- `GET /api/v1/play/:gameId/character/:characterId` (player dashboard; poll for updates)

## Local development (single command)
### Requirements
- Node.js >= 18

### Install
From the repo root:

```bash
npm run install:all
```

### Run (2-in-1 dev)
From the repo root:

```bash
npm run dev
```

### URLs
- **Frontend (launcher)**: `http://localhost:5173/`
- **API health**: `http://localhost:3000/health`
- **API docs (OpenAPI UI)**: `http://localhost:3000/docs`

## Repo layout
- `mmd-api/`: Fastify server, Prisma schema/migrations, OpenAPI
- `mmd-frontend/`: React UI, schemas, adapters, polling hooks
- `docs/`: design notes and plans

