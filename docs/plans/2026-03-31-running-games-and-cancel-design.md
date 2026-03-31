# Running games + cancel game (no-stranding) design

**Goal:** The root page must show games you can access after reload (host or player), allow hosts to cancel games (no destructive deletes), preserve history, and keep UI simple during dev/staging (public access).

**Non-negotiables (from requirements):**
- No destructive deletes (preserve history).
- Host is never stranded after a reload.
- History preserved and visible (public for now).
- UI stays simple.
- Do not create a new surface.
- Use a global host action to access invite links.
- Minimal API surface.

---

## Problem statement

Today, a host can create a game and get invite links, but after reloading the root (`/`) the host can lose access to those links and has no way back into the host view for that game. The app has no user accounts, so we must provide persistence + discovery without authentication for now.

---

## Design summary

We implement **two complementary lists** on the root page plus a host-only global action:

1) **All games (public, server list)**: root page shows all games from the server (active + history). This is the “global view”.

2) **Your links (this device, local registry)**: root page shows the host/player links you have created/visited on this device, persisted in `localStorage`. This prevents stranding after reload. This is the “access view”.

3) **Host invite links always available via a global host action**: in host mode, provide a single global action (header button) to toggle showing existing `HostInfoCard` (player invite links + joined status) without creating a new surface.

---

## Backend changes (minimal API)

### Existing endpoints used
- `GET /api/v1/games`: list all games (already exists).
- `POST /api/v1/games`: create game (already exists).
- `GET /api/v1/games/:id/host` (x-host-key): host view (already exists).

### New endpoint (only one)
- `POST /api/v1/games/:id/host/cancel` (header `x-host-key`)
  - Sets `game.state = 'CANCELLED'`
  - Preserves all related data (players/events/answers) — **no deletes**
  - (Optional) records a `CANCEL_GAME` event in `gameEvent` for auditability

**State model update**
- Add `CANCELLED` to the game state enum used by Prisma/schema as needed.

---

## Frontend changes

### Root page (`/`) additions

Keep the existing launcher create flow, then add:

#### A) “All games” panel (public)
- Fetch from `GET /api/v1/games` using current API base.
- Show two groups (simple filter/tabs):
  - **Active**: `SCHEDULED | PLAYING | REVEAL`
  - **History**: `DONE | CANCELLED`
- Each row shows: name/story, state, scheduledTime, and gameId.

#### B) “Your links (this device)” panel (local)
- Persist a registry in `localStorage` keyed by something like `mmd:links:v1`.
- Each entry stores:
  - `gameId`, `apiBase`
  - `hostKey?` (if known)
  - `characterIds[]` (if known)
  - `lastSeenAt` (for ordering)
  - Optional display hints (name/storyTitle) if available at capture-time
- Entry capture points:
  - On create game: store gameId + apiBase + hostKey + all characterIds.
  - On host route load (`/host/:gameId?...hostKey=`): store gameId + apiBase + hostKey.
  - On player route load (`/play/:gameId/:characterId`): store gameId + apiBase + characterId.

Actions per saved game:
- **Open host** (only when `hostKey` known).
- **Open player** links (for stored characterIds).
- **Cancel game** (only when `hostKey` known): calls `POST /api/v1/games/:id/host/cancel`, then refreshes both lists.
- **Forget** (local only) may be added later if needed, but is not required for this scope.

### Host invite links (no new surface)

In host mode:
- Add a **global header action** “Invite links”.
- It toggles rendering of the existing `HostInfoCard` (bound to `screenData.hostInfo`) within the existing host page layout.
- No new route, no new surface component; just conditional rendering.

---

## UX notes (simplicity)

- Reuse existing `.panel`, `.link-row`, `.mini-btn` styling and patterns.
- Keep mobile-first layout with stacked panels.
- Avoid adding authentication/permissions flows for now (public dev/staging).

---

## Acceptance criteria

- Host creates a game → reload root → **host link still discoverable** under “Your links”.
- Player opens a player link once → reload root → link appears under “Your links”.
- Root shows **All games** (active + history).
- Host can always access invite links via the global “Invite links” action, even mid-game.
- “Cancel game” transitions state to `CANCELLED` and the game appears under history; no destructive deletes occur.

