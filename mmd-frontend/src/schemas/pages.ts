/**
 * Application screen map — read this file first.
 *
 * ## Routes & view mode (`useViewMode` in `src/hooks/useAppState.ts`)
 * - `launcher` — root: create/list games (`state` from `useLauncherState`).
 * - `host` — legacy host URL; same data as host polling (`useHostScreenData`).
 * - `room` — `/room/:gameId/:characterId` — player (and optional host key); `usePlayerScreenData` + same host hook when `hostKey` present.
 *
 * ## Which schema when (`AppController` + `selectPageSchema`)
 * | mode      | Primary `PageSchema`    | Rendering |
 * |-----------|-------------------------|-----------|
 * | launcher  | `launcherPageSchema`    | `PageRenderer` → declarative `layouts.root` |
 * | host      | `hostPageSchema`        | `PageRenderer` → stage + feed + actions |
 * | room      | `playerPageSchema`     | **Tabs** drive surfaces, not `layouts` (see below) |
 *
 * ## Room mode (player) — tabs vs schema
 * `playerPageSchema.tabs` supplies BottomNav labels only. Actual UI is **first-class surfaces**:
 * - `lobby` → `joinPageSchema` + `LobbySurface` (pregame feed + host controls when `hostKey`), wired in **`RoomRouter`**.
 * - `game` → `GameSurface` (stage rail, objectives, composer, feed).
 * - `profile` → `ProfileSurface`.
 *
 * So: launcher/host are “pure schema” pages; room is schema for chrome + documented surface split.
 *
 * ## Layout nodes (`LayoutNode` in `src/data/types.ts`)
 * Rendered by `RenderNode` (`src/components/primitives/RenderNode.tsx`). Primitive UI pieces live under
 * `src/components/primitives/` (e.g. `Card`, `List`, `Stage`); **semantic** `className` on `Card` /
 * `list-block` comes from node `id` or fixed names (`join-card`, `profile-card`, `host-info-card`).
 *
 * | `type`        | `bind` (typical)   | Notes |
 * |---------------|--------------------|-------|
 * | stage         | game               | Act banner + optional `player-pills` wrapper around `Pills` |
 * | feed          | feed               | Chronological items |
 * | list          | *                  | `List`; extra class from node `id` |
 * | actions       | gameActions        | Primary host pacing buttons |
 * | profile-card  | profile            | `Card` + `.profile-card` |
 * | host-info     | hostInfo           | `Card` + `.host-info-card` (invites) |
 * | composer      | composer           | Feed post UI (`ComposerPanel`) |
 * | launcher      | launcher           | Playtest launcher + games list |
 * | join-card     | join               | `Card` + `.join-card` |
 * | section       | —                  | Group with optional `title` + child nodes |
 */
import type { PageSchema } from '../data/types'

/** Root: API base, story picker, create game, merged games list (see `LauncherCard`). Mode → schema selection: `selectPageSchema.ts`. */
export const launcherPageSchema: PageSchema = {
  id: 'launcher',
  layouts: {
    root: [{ id: 'launcher', type: 'launcher', bind: 'launcher' }],
  },
}

/** Pregame entry: hero stage + name field (`join-card`). Shown with `LobbySurface` in room/lobby. */
export const joinPageSchema: PageSchema = {
  id: 'player-entry',
  layouts: {
    root: [
      { id: 'stage', type: 'stage', bind: 'game' },
      { id: 'join-card', type: 'join-card', bind: 'join' },
    ],
  },
}

/**
 * In-room player chrome: tabs only. Layouts intentionally empty — see class comment above.
 */
export const playerPageSchema: PageSchema = {
  id: 'player-game',
  tabs: [
    { id: 'lobby', label: 'Lobby' },
    { id: 'game', label: 'Game' },
    { id: 'profile', label: 'Profile' },
  ],
  layouts: {},
}

/** Dedicated host screen: stage, full feed, pacing actions (API host view). */
export const hostPageSchema: PageSchema = {
  id: 'host-game',
  tabs: undefined,
  layouts: {
    root: [
      { id: 'stage', type: 'stage', bind: 'game' },
      { id: 'feed', type: 'feed', bind: 'feed' },
      { id: 'actions', type: 'actions', bind: 'gameActions' },
    ],
  },
}
