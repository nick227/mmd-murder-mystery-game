# Frontend architecture rules (MMD)

Short, reviewable rules to **prevent regression** after refactors. Extend only by team agreement.

## Data flow (one direction)

Allowed:

`hooks → screenData / UIModel → surfaces → primitives`

Forbidden:

- `surface → hook` (surfaces do not import or call data hooks directly; use props/context from above)
- `primitive → hook`
- `schema` modules importing `hooks` or triggering side effects

## App shell (`src/app/`)

- **`App.tsx`** — entry + global CSS import only.
- **`AppController.tsx`** — hooks, derived state, `RoomProvider` value, tab sync (`useRoomTabSync`).
- **`AppView.tsx`** — layout shell only (no room data props except what’s still global).
- **`RoomRouter.tsx`** — room tab routing; reads **`RoomProvider`** via `useRoomContext()` (no long prop lists).
- **`roomContext.tsx`** — `RoomContextValue` (player `screenData` / `handlers`, `pins`, host pacing props).
- **`deriveAppShellSurface.ts`** — `data-surface` value for the shell (`launcher` / `host` / `lobby` / `game` / `profile`).
- **`useRoomTabSync.ts`** — syncs active tab when `game.state` changes (joined room).
- **`schemas/selectPageSchema.ts`** — `selectPageSchema(mode)` for launcher / host / room `PageRenderer` schemas.

## Folder boundaries (target layout)

| Area | Responsibility |
|------|------------------|
| `primitives/` | Presentational only; no app business rules |
| `surfaces/` | One screen concern per surface; compose primitives |
| `schemas/` | Declarative layout data only |
| `hooks/` | State, effects; no UI imports |
| `navigation/` | Routes, URL builders |
| `app/` (optional) | Shell composition only |

**Import bans (enforce with ESLint when paths exist):**

- `primitives` must not import from `surfaces`
- `hooks` must not import from `components` (UI)
- `schemas` must not import from `hooks`

## Shell composition (`App`)

- **No UI business logic** in `App` (routing policy, “which surface when,” join vs game) — belongs in controllers/routers/derivation helpers.
- **No nested ternaries** for mode/state selection — use maps, routers, registries.
- **Prop drilling** at most **two levels** below the shell; prefer context or explicit props objects for room/player/host.

## Surfaces

- **No cross-surface imports** — shared code lives in `hooks/`, `context/`, or small `lib/` utilities.
- Each surface owns **one** primary concern (lobby vs game vs profile); host/global controls do not leak into unrelated surfaces.

## Data access

- Avoid **deep `screenData` access** scattered in JSX (`screenData.game.state` repeated everywhere). Prefer selectors/hooks (`useGameState`, etc.) once introduced.
- Prefer a **UI contract** (`UIModel`) between adapters and UI so API changes do not ripple unchecked.

## Stability

- **Primitives** stay stable (props, semantics, a11y). Churn belongs in hooks/surfaces/adapters.
- **Capabilities** over scattered booleans: prefer objects like `uiCapabilities` derived in one place.

## Onboarding

- Keep a **render-path comment** (ASCII tree) at the top of the main shell component; update when hierarchy changes.

## DevTools markers (optional but recommended)

For `data-surface`, `data-ui`, and related conventions, see **[`ui-devtools-conventions.md`](./ui-devtools-conventions.md)**.

**Single owner:** `data-surface` and `data-game-state` live only on the app shell root in **`AppView`** (`div.app-shell`); `document.body` has `data-mode` (set in **`AppController`**). Avoid duplicating game state on inner components.

---

*Violations in hot paths should block PRs once lint rules land; until then, use this file in code review.*
