# Player room: Feed / Game / Profile tab refactor

## 1. Current architecture (review)

### 1.1 Data flow (unchanged by this refactor)

The API → `api.ts` → `adapters.ts` → `useAppState` → components pipeline stays the single path. `ScreenData` already carries everything the player needs (`game`, `players`, `feed`, `join`, `composer`, `profile`, `view`, etc.). No new endpoints are required for tab reshuffling.

### 1.2 Room mode routing

- **`AppMain`** (`mmd-frontend/src/components/app/AppMain.tsx`): In `mode === 'room'`, content is **`RoomRouter`** only; `playerPageSchema.layouts` is empty by design.
- **`RoomRouter`** (`mmd-frontend/src/app/RoomRouter.tsx`): Switches on **`activeTab`** (`TabId`) and mounts:
  - **`LobbySurface`** → **`PlayerLobbyTemplate`** — game meta, story `Stage`, `JoinCard`, `PresenceRail`, host controls (if host key), status copy, `ComposerPanel`, **`Feed`**.
  - **`GameSurface`** → **`PlayerGameTemplate`** — act `Stage`, `DoNowPanel`, `EvidenceSection` (+ waiting UI when `SCHEDULED`).
  - **`ProfileSurface`** → **`PlayerProfileTemplate`** — character profile lists.
- **Not joined**: Only the **`lobby`** tab renders real lobby UI; **`game`** / **`profile`** show a “Join first” placeholder (with optional Google sign-in CTA).

### 1.3 Tab chrome

- **`AppController`** (`mmd-frontend/src/app/AppController.tsx`): `useTabState`, default **`lobby`** in room mode; **`useEffect`** forces **`lobby`** when `!player.joined`.
- **`playerPageSchema.tabs`** (`mmd-frontend/src/schemas/pages.ts`): `{ Lobby, Game, Profile }` — labels for **`BottomNav`** only (documented in file header).
- **`AppView`** → **`AppTabs`** → **`BottomNav`**: Fixed bottom buttons; **`data-tab`** on shell from `AppShell`.

### 1.4 Shell / DevTools surface

- **`deriveAppShellSurface`**: Unjoined → `'lobby'`; joined → **`activeTab`** (`lobby` | `game` | `profile`).
- **`SurfaceId`** / **`AppShellSurface`** (`mmd-frontend/src/utils/uiMarkers.ts`): Player surfaces are **`lobby` | `game` | `profile`**.

### 1.5 Templates today

| Template | Role |
|----------|------|
| **`PlayerLobbyTemplate`** | “Social + prep” surface: meta panel, story stage, join, presence, host bar, status, composer, feed. |
| **`PlayerGameTemplate`** | “In-fiction” surface: act stage, objectives, evidence modal stack. |
| **`PlayerProfileTemplate`** | Character sheet. |

Props are centralized in **`playerTemplateProps.ts`**.

---

## 2. Target UX (from product intent)

- **Three tabs**: **Feed**, **Game**, **Profile** (replacing **Lobby**, **Game**, **Profile**).
- **Feed** tab: Absorb **current lobby content** except what already belongs exclusively on Game or Profile (see §3). Timeline / room activity stays the primary home tab.
- **Game** tab: Same as today’s **`PlayerGameTemplate`** (including SCHEDULED waiting state).
- **Profile** tab: Same as today’s **`PlayerProfileTemplate`**.
- **Remove** the existing bottom trio **Lobby | Game | Profile** — meaning: **replace** that navigation with **Feed | Game | Profile** and consolidate the three player templates under that single tab model (not three parallel top-level “modes” named Lobby/Game/Profile).

**Clarification to lock in during implementation**

- If “get rid of bottom buttons” means **no bottom bar at all**, that conflicts with workspace **UX standards** (fixed tab bar above safe area, thumb zone). The intended interpretation here is: **remove the old three labels/ids**, not necessarily remove all bottom navigation. Default plan: **keep a bottom tab bar** using the same **`BottomNav`** / **`AppTabs`** pattern with updated **`TabId`** and labels, unless design explicitly moves tabs to the top.

---

## 3. Content mapping

| Current location | After refactor |
|------------------|----------------|
| Lobby: game details panel, story `Stage`, join, presence, host controls, status, composer, **`Feed`** | **Feed tab** (same blocks; optional copy tweaks: “Lobby” → “Feed” in user-facing strings where appropriate). |
| Game: act stage, do now, evidence | **Game tab** (unchanged behavior). |
| Profile | **Profile tab** (unchanged behavior). |

**Join gating**: Mirror **`RoomRouter`** rules: when not joined, **Feed tab** shows join flow; **Game** / **Profile** remain “Join first” (or equivalent), with **`useEffect`** defaulting tab to **`feed`** instead of **`lobby`**.

---

## 4. Proposed technical approach

### 4.1 Rename `TabId` and schema

- Change **`TabId`** in **`mmd-frontend/src/data/types.ts`** from `'lobby' \| 'game' \| 'profile'` to **`'feed' \| 'game' \| 'profile'`** (or add **`feed`** and deprecate **`lobby`** in one shot).
- Update **`playerPageSchema.tabs`** to **Feed / Game / Profile** with ids **`feed`**, **`game`**, **`profile`**.
- Update **`pages.ts`** file-level comment block (room mode section) to describe **feed → FeedSurface/Lobby content**, not “lobby → LobbySurface”.

### 4.2 `RoomRouter`

- Replace every **`activeTab === 'lobby'`** branch with **`feed`**.
- **`GameSurface`** / **`ProfileSurface`** branches stay; only the first tab’s surface changes.
- **`LobbySurface`** can remain a thin adapter **or** be renamed to **`FeedSurface`** for clarity (recommended if the word “lobby” should disappear from public UI and code paths).

### 4.3 `AppController` + `deriveAppShellSurface`

- Default tab in room mode: **`feed`** (was **`lobby`**).
- Force-tab effect when unjoined: **`setActiveTab('feed')`**.
- **`deriveAppShellSurface`**: For unjoined players, today returns **`'lobby'`**. Either:
  - Map **`feed`** → **`'lobby'`** in **`SurfaceId`** for minimal CSS/token churn, **or**
  - Extend **`SurfaceId`** / theme with **`'feed'`** and update **`PlayerLobbyTemplate`** / **`Surface`** usage (`surface="lobby"` → **`feed`**) plus **`app.css`** role surfaces — only if you want DevTools and tokens to say “feed” everywhere.

### 4.4 Consolidating templates under one tab system

Two viable patterns:

**Option A — Minimal move (recommended for first PR)**  
Keep **`PlayerLobbyTemplate`**, **`PlayerGameTemplate`**, **`PlayerProfileTemplate`** as presentational modules. **`RoomRouter`** (or renamed **`PlayerRoomRouter`**) remains the switch. Optionally add a thin **`PlayerRoomTabs`** wrapper that only holds **tab UI** if you ever lift tab state locally (not required if tabs stay in **`AppController`**).

**Option B — Single shell component**  
Introduce **`PlayerRoomShell`** (or **`PlayerRoomView`**) that receives **`ScreenData`** + handlers and renders **segmented/tab header + three panels**. **`RoomRouter`** becomes a one-liner. Higher churn; better if you plan swipe-between-tabs and shared scroll state in one place.

Start with **Option A** unless you explicitly want one file to own all three panes.

### 4.5 Bottom navigation

- **`BottomNav`** / **`AppTabs`**: Update **`data-testid`** usage from **`bottom-nav-lobby`** → **`bottom-nav-feed`** (and any E2E).
- If product truly wants **no** global bottom nav: move tab control **inside** a full-bleed room layout and adjust **`AppView`** so **`showTabs`** is false for `mode === 'room'`, then implement tabs inside **`RoomRouter`** — larger layout change; document separately.

### 4.6 Types and naming cleanup

- **`hostLobbyActions`** in **`roomContext`** / **`AppController`**: Optional rename to **`hostFeedActions`** (or keep if it only means “actions shown on the feed/room surface”).
- **`AppShell`** **`data-tab`**: Values become **`feed` \| `game` \| `profile`** — update **`docs/ui-devtools-conventions.md`** if you keep that table in sync.

### 4.7 Tests

- **`mmd-frontend/tests/e2e/game.spec.ts`**: Replace **`bottom-nav-lobby`** / navigation assumptions with **`feed`** as needed.
- Any unit tests that assert **`lobby`** tab id.

### 4.8 Workspace rules

- After implementation, update **`.cursor/rules/ux-standards.mdc`** references that say **`game | objectives | profile`** if they still say “objectives” vs “game” — align wording with **Feed / Game / Profile** where the doc describes player tabs.
- **Pull-to-refresh** (if/wired): Rules say Feed under **`game`** tab — that was written for a different IA; after refactor, pull-to-refresh belongs on the **Feed** tab only. Fix the rule when behavior is implemented.

---

## 5. Files likely to touch (checklist)

| Area | Files |
|------|--------|
| Types | `data/types.ts` (`TabId`, `TabSchema` usage) |
| Schema + docs comment | `schemas/pages.ts` |
| Router | `app/RoomRouter.tsx` |
| Shell surface | `app/deriveAppShellSurface.ts`, optionally `utils/uiMarkers.ts` |
| Controller | `app/AppController.tsx` (defaults, effects) |
| Surfaces | `LobbySurface.tsx` (rename?), `GameSurface.tsx`, `ProfileSurface.tsx` |
| Templates | `PlayerLobbyTemplate.tsx`, `playerTemplateProps.ts` (rename types if Feed) |
| UI tokens | `styles/app.css` if `surface="feed"` or class renames |
| E2E | `tests/e2e/game.spec.ts` |
| DevTools doc | `mmd-frontend/docs/ui-devtools-conventions.md` |

---

## 6. Risks and mitigations

| Risk | Mitigation |
|------|------------|
| Missed string/`data-tab` references | Ripgrep **`lobby`** in `mmd-frontend` after changes. |
| E2E flake from new test ids | Update selectors in one pass; run `game.spec.ts`. |
| Host + player mental model | “Feed” = room timeline + join; host controls stay on that surface until moved elsewhere. |

---

## 7. Suggested implementation order

1. Add **`feed`** to **`TabId`**, migrate **`lobby` → `feed`** across router, controller, schema, shell derivation, and tests (compile-first).
2. Rename presentation files (**`LobbySurface` → `FeedSurface`**, template props) only if you want naming consistency; otherwise leave filenames for a follow-up.
3. Run frontend build and E2E for room flow (join, switch tabs, host key on feed).
4. Update Cursor UX rule line about tabs/pull-to-refresh when behavior matches.

---

## 8. Out of scope (unless explicitly added later)

- Swipe-between-tabs gesture (required by UX standards — can be a follow-up once tab container is stable).
- Moving host pacing out of the Feed tab into a host-only surface.
- Schema-driven player layouts (`PageRenderer` for room mode) — current architecture intentionally bypasses that.
