# Running games + cancel game Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Root page reliably exposes accessible games after reload (host/player), hosts can cancel (soft-cancel, no deletes), history is preserved and visible, and hosts can always access invite links via a global action (no new surface).

**Architecture:** Use a dual-source discovery model: server provides the public “All games” list; device-local `localStorage` provides “Your links” access recovery. Add one minimal host-only API endpoint to soft-cancel games. Expose host invite links via a global header toggle that shows the existing `HostInfoCard`.

**Tech Stack:** React + TypeScript (Vite), Fastify + Prisma (Node), localStorage for per-device persistence.

---

### Task 1: Add CANCELLED state + cancel endpoint (API)

**Files:**
- Modify: `mmd-api/prisma/schema.prisma`
- Modify: `mmd-api/src/schemas/index.ts` (or wherever Game state schema is defined)
- Modify: `mmd-api/src/routes/games.ts`

**Step 1: Write failing API test (if test harness exists)**
- If API tests exist in repo, add a test for:
  - create game → cancel with valid `x-host-key` → state becomes `CANCELLED`
  - cancel with invalid key → 401
  - cancel already DONE/CANCELLED → 400 (define exact behavior in implementation)

**Step 2: Run API tests to verify fail**
- Run: `npm test` (or repo-specific API test command)
- Expected: FAIL until endpoint exists

**Step 3: Implement state + endpoint**
- Add enum value `CANCELLED` to the Prisma game state enum.
- Add `POST /api/v1/games/:id/host/cancel`:
  - validate host key
  - update game state to `CANCELLED`
  - optional: add a `CANCEL_GAME` event

**Step 4: Run API tests**
- Expected: PASS

**Step 5: Commit**
- Commit message: `feat(api): add host cancel game`

---

### Task 2: Add frontend API functions for list games + cancel

**Files:**
- Modify: `mmd-frontend/src/data/api.ts`
- Modify: `mmd-frontend/src/data/sources/types.ts`
- Modify: `mmd-frontend/src/data/sources/apiGameSource.ts` (and any other source used)

**Step 1: Add `fetchGames(apiBase)`**
- Maps to `GET /api/v1/games`.

**Step 2: Add `cancelGame(apiBase, gameId, hostKey)`**
- Maps to `POST /api/v1/games/:id/host/cancel` with `x-host-key`.

**Step 3: Wire into `GameSource`**
- Extend interface and implement for API source.

**Step 4: Commit**
- Commit message: `feat(frontend): add games list + cancel APIs`

---

### Task 3: Implement local “Your links” registry (frontend)

**Files:**
- Create: `mmd-frontend/src/data/runningGamesRegistry.ts`
- Modify: `mmd-frontend/src/hooks/useAppState.ts`

**Step 1: Create registry module**
- Key: `mmd:links:v1`
- Types:
  - `StoredGameLink { gameId, apiBase, hostKey?, characterIds: string[], lastSeenAt }`
- Functions:
  - `readStoredGames()`
  - `upsertHostLink({ gameId, apiBase, hostKey })`
  - `upsertPlayerLink({ gameId, apiBase, characterId })`
  - `upsertCreatedGame({ gameId, apiBase, hostKey, characterIds })`

**Step 2: Hook capture points**
- On create game success: call `upsertCreatedGame`.
- On host mode load (route parsing available in `useViewMode`): call `upsertHostLink`.
- On player mode load: call `upsertPlayerLink`.

**Step 3: Commit**
- Commit message: `feat(frontend): persist accessible game links locally`

---

### Task 4: Root page UI — show “All games” and “Your links”

**Files:**
- Modify: `mmd-frontend/src/data/types.ts` (launcher data additions)
- Modify: `mmd-frontend/src/data/mock.ts` (default launcher data)
- Modify: `mmd-frontend/src/hooks/useAppState.ts` (load games list; expose to renderer)
- Modify: `mmd-frontend/src/components/Primitives.tsx` (extend `LauncherCard` to render lists)
- Modify: `mmd-frontend/src/styles/app.css` (only if needed; prefer existing styles)

**Step 1: Extend launcher screen data**
- Add `launcher.allGames[]` and `launcher.savedGames[]` (from registry).

**Step 2: Fetch and display server games list**
- Fetch using `fetchGames(apiBase)` alongside stories load or in a separate effect.
- Render grouped Active/History.

**Step 3: Display saved links**
- Render Open/Copy actions.
- Show Cancel button only when hostKey known.

**Step 4: Commit**
- Commit message: `feat(frontend): show all games + saved links on launcher`

---

### Task 5: Host global action — “Invite links” toggle (no new surface)

**Files:**
- Modify: `mmd-frontend/src/App.tsx`
- Modify: `mmd-frontend/src/schemas/pages.ts` (host layout includes host-info node)
- Ensure existing `HostInfoCard` is used (already exists in `Primitives.tsx`)

**Step 1: Add host layout node**
- Add `{ id: 'host-info', type: 'host-info', bind: 'hostInfo' }` to host root layout.

**Step 2: Add header button**
- Only in host mode, toggle showing host-info node (simple boolean state).
- This is the “global host action”.

**Step 3: Commit**
- Commit message: `feat(frontend): add host invite links global toggle`

---

### Task 6: Verification

**Step 1: Manual smoke**
- Create game → reload root → confirm saved links exist.
- Open host → press Invite links → see and copy player links.
- Cancel game → game moves to history and host view updates accordingly.

**Step 2: Run existing automated checks**
- Frontend: `npm test` / `npm run test:e2e` (repo-standard)
- API: `npm test` (repo-standard)

**Step 3: Final commit (if any small fixups)**

