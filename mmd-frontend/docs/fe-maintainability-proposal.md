# Frontend maintainability proposal

Target: **mmd-frontend** — reduce cognitive load for new contributors and long-term upkeep.

- **Section A (below)** — twenty documentation, layering, and hygiene items (ordered by leverage).
- **Section B** — high-impact **structural** refactors (mode/router/context/split App). These address *code shape*, not only docs.
- **Section C** — **architecture rules** (data-flow, folders, contracts, capabilities). Enforceable norms that stop complexity from returning; see also [`ARCHITECTURE_RULES.md`](./ARCHITECTURE_RULES.md).
- **Section D** — **DevTools discoverability** (`data-*` markers, layout classes, optional debug overlay). See [`ui-devtools-conventions.md`](./ui-devtools-conventions.md).

---

1. **Single “start here” map** — Keep one authoritative entry (e.g. expand `schemas/pages.ts` or add `docs/ARCHITECTURE.md`) that lists: routes/view modes, which file owns each screen, and how `PageRenderer` / surfaces relate. Link it from `mmd-frontend/README.md`.

2. **Explicit data-flow diagram** — A short Mermaid or ASCII diagram for `useViewMode` → `App` → `PageRenderer` / `LobbySurface` / `GameSurface` / hooks → `ScreenData`. New hires should not have to trace this by reading `App.tsx` alone.

3. **Name the two UI models** — Document clearly: (A) **declarative layout** (`LayoutNode` + `RenderNode`) vs (B) **hand-built surfaces** (Lobby/Game/Profile). Explain *why* room mode split so future changes do not fight the architecture.

4. **ScreenData field glossary** — A table in `docs/` or inline in `types.ts`: each top-level `ScreenData` key, who writes it (`adapters`, hooks), and who reads it (which primitive/surface). Reduces “where does this value come from?” churn.

5. **Stable public API for hooks** — Export a small `hooks/index.ts` (or document `useAppState` sections) listing the hooks intended for UI vs internal helpers. Discourage importing deep paths without a re-export barrel for app-level hooks.

6. **Shrink `App.tsx` responsibilities** — Move mode-specific branches into `AppRoom.tsx`, `AppLauncher.tsx`, `AppHost.tsx` (or similar) so `App` is composition + providers only. Large conditional trees are hard to review and test.

7. **Consistent error and loading UX** — One pattern for `loading` / `error` from `usePlayerScreenData` / `useHostScreenData` (banner, inline, toast). Document the pattern so every surface does not invent its own.

8. **Composer vs feed contract** — Short doc for `PostKind`, API `moveType` mapping, and `feedRichText` token rules. Backend field names can stay; the *mental model* should be “feed post,” not scattered comments.

9. **Primitives discipline** — `CONTRIBUTING.md` rule: primitives stay generic (`Card`, `List`, `Pills`); semantic classes and copy live at `RenderNode` or surface level. Prevents re-explosion of `*Card` components.

10. **Co-locate tests with features** — Where practical, colocate Playwright specs or unit tests next to the feature they guard (or mirror `src/` under `tests/`). Document how to run smoke vs full E2E.

11. **Visual regression or storybook (optional phase)** — For repeated panels (`Card`, lists, composer), add Storybook or Chromatic-style snapshots *only if* the team will maintain them; otherwise skip to avoid dead stories.

12. **Stricter ESLint for imports** — `eslint-plugin-import` boundaries: e.g. `primitives` cannot import from `surfaces`, `data/adapters` cannot import from `components`. Catches accidental layering violations early.

13. **Typed route builders** — Centralize `/room/...`, `/host/...` URL construction in `src/navigation/` or `src/routes.ts` with small helpers and tests. Stops duplicated string concat and query-param bugs.

14. **API client as single façade** — Keep `data/api.ts` as the HTTP surface; document which methods map to which REST paths. Consider generated types from OpenAPI later; until then, one table in `docs/api-frontend.md`.

15. **Mock vs API parity** — If `mock` / demo paths remain, document divergence from `apiGameSource` and add a checklist when adding a new endpoint so mocks do not silently rot.

16. **Performance budget notes** — Document polling intervals (`reload` / intervals in hooks) and what would trigger moving to websockets. Prevents accidental duplicate polling when adding features.

17. **Accessibility checklist** — For new UI: focus order for join flow, `aria-label` on nav (already partially there), live regions for feed updates if needed. Short checklist in `docs/a11y.md`.

18. **Rename confusing domain terms in UI only** — Where “objective,” “card,” and “feed” overload the same words, prefer consistent user-facing strings and keep technical names in `types.ts` with a one-line comment each.

19. **Onboarding script** — `package.json` script `npm run dev:check` that runs `tsc`, lint, and unit tests (if added). One command before PRs reduces “works on my machine” for TypeScript.

20. **Quarterly dependency & dead-code pass** — Scheduled removal of unused exports (`ts-prune` or `knip`), dependency updates, and a short changelog for frontend-only releases so maintenance is routine, not heroic.

---

*Section A is a proposal, not a commitment sequence. Prioritize items 1–6 for the fastest clarity wins; items 11–14 are medium-term structure; 15–20 are hygiene and scale.*

---

## Section B — Structural refactors (high impact)

These complement Section A: documentation helps people *read* the code; structure helps them *change* it safely. Several items here subsume or sharpen Section A item 6 (`Shrink App.tsx`).

### The root problem

Three architectures are currently mixed in one place:

| Layer | What it is | Example |
|-------|------------|---------|
| Declarative schema | `LayoutNode` + `RenderNode` + `PageSchema` | Launcher, host page, join pre-layout |
| Surface components | Hand-built screens | `LobbySurface`, `GameSurface`, `ProfileSurface` |
| Mode router | `AppController` + `AppView` + `RoomRouter` branch on `mode`, joined, tabs | Was nested ternaries in one file; now split |

**Separating these** (controller vs view vs router vs context) is the main structural win; Section A alone cannot fix that.

---

### B1. Split mode controller from UI (~largest single win)

**Done in repo:** `AppController` decides launcher vs host vs room and body `data-mode`; `AppView` renders shell + sheets; `RoomRouter` picks joined vs lobby vs game + schema; `useRoomTabSync` syncs tabs; `selectPageSchema(mode)` picks launcher / host / room schemas.

**Target:**

| File | Responsibility |
|------|------------------|
| `App.tsx` | Providers only (future: `RoomProvider`, query client, theme) |
| `AppController.tsx` | Mode + routing logic, which hooks run, derived state |
| `AppView.tsx` | Pure render from props (no business rules) |

Rough complexity reduction for readers: **~40%** in the hot path once `AppView` is dumb.

---

### B2. Extract room UI into `RoomRouter`

**Done in repo:** `RoomRouter.tsx` handles joined vs lobby vs game + `PageRenderer` wiring.

**Original problem:** The `mode === 'room' ? !player.joined ? …` block was dense and hard to extend.

**Reference shape** (props may differ; room data often comes from `useRoomContext()`):

```tsx
<RoomRouter
  joined={player.joined}
  activeTab={activeTab}
  hostKey={hostKey}
  …
/>
```

Contributors should not parse nested ternaries to understand room behavior.

---

### B3. Kill nested ternaries for state selection

Replace chains like:

`mode === 'host' ? host : mode === 'room' ? player : launcher`

with a **lookup** (record / map) keyed by mode, e.g. `const state = stateMap[mode]`, with exhaustiveness checked by TypeScript. Same for schema selection (see B9).

---

### B4. Extract header into `AppHeader`

Header logic depends on mode, `hostKey`, joined, loading, error, and derived `state`. Move to `<AppHeader {...headerState} />` so `App` / `AppView` reads as:

`AppHeader` → main content → `BottomNav` → invite sheet.

---

### B5. Introduce `RoomContext` (or narrow providers)

Today: `player.screenData`, `player.handlers`, `host.screenData`, `host.handlers`, `host.error` are threaded through props.

**Target:** `RoomProvider` wrapping room subtree so surfaces read **context** instead of long prop lists (can remove a large fraction of prop drilling once boundaries are clear).

---

### B6. Move tab rules out of `App`

`useTabState` defaults and “which tab when game state changes” should live in **`useRoomTabs()`** (or equivalent). `App` should not own tab business rules.

---

### B7. Flatten `ScreenData` access with selectors

Repeated `player.screenData.game.state` (and similar) spreads knowledge of shape everywhere.

**Target:** small hooks or selectors, e.g. `useGameState()`, `useJoined()`, `useIsHost()`, implemented over context or a thin store—**not** a second source of truth.

---

### B8. Rename `mode` for clarity

`mode` currently means launcher | host | room, which collides mentally with “game mode,” “tab mode,” etc.

**Candidates:** `view`, `appView`, or `routeKind`—pick one term and use it consistently in hooks and components.

---

### B9. Move schema selection out of `App`

Replace inline `const schema = mode === 'host' ? …` with **`usePageSchema(mode)`** (or a pure function + hook) so `App` does not embed page-schema policy.

---

### B10. Explicit `AppLayout`

Make shell structure visible:

```tsx
<AppLayout
  header={<AppHeader />}
  content={<Main />}
  nav={<BottomNav />}
  modal={<InviteSheet />}
/>
```

Reduces “where does this slot live?” confusion.

---

### B11. Surface registry for room tabs

Instead of `activeTab === 'profile' ? <ProfileSurface /> : …`, use a **registry** keyed by tab id that returns the surface component. Keeps tab additions one-line changes and avoids another ternary tree.

---

### B12. Long term: route-level components (optional)

Push toward **one file per top-level view**, e.g. `<Route view="room">`, `<Route view="host">`, `<Route view="launcher">`, with `App` delegating to `CurrentRoute`. This aligns with B1–B2 and removes mode branching from a single mega-component.

---

### If you only do three things

1. **Split `App` → `AppController` + `AppView`** (B1).  
2. **Extract `RoomRouter`** (B2).  
3. **Add `RoomContext` / `RoomProvider`** (B5).

Everything else in Section B stacks on those.

**Optional follow-ups (not blocking):** extract `AppHeader` / `AppLayout` (B4, B10), `useRoomTabs` (B6), route-level components (B12).

---

### Mapping Section A ↔ Section B

| Section A | Section B overlap |
|-----------|-------------------|
| A6 Shrink `App` | B1, B2, B4, B10 |
| A5 Hooks API | B5, B6, B7 |
| A13 Route builders | B2, B12 |
| A3 Two UI models | “Root problem” table |

---

## Section C — Architecture discipline (items 21–30)

These complement docs (Section A) and file splits (Section B): they define **rules** so refactors do not erode. Several are **lint- or review-enforceable**.

---

### 21. Enforce one-direction data flow

**Rule:** `hooks → screenData → surfaces → primitives`

**Never:** `surface → hook`, `primitive → hook`, `schema → hook` (schemas do not call hooks).

Surfaces compose primitives and read data passed in or from context; hooks live at the boundary. This prevents architecture drift when a shortcut “just this once” wires a button to `fetch`.

---

### 22. Hard folder boundaries (lint-enforceable)

**Intended layout:**

| Folder | Role |
|--------|------|
| `primitives/` | Dumb UI only |
| `surfaces/` | Screen-level composition and behavior |
| `schemas/` | Declarative layout definitions |
| `hooks/` | State, effects, subscriptions |
| `navigation/` | Routing helpers, URL builders |
| `app/` (optional) | Shell composition only (`App`, layout slots) |

**Example bans (adjust to match repo once folders exist):**

- `surfaces → primitives` ✔  
- `primitives → surfaces` ✖  
- `hooks → components` ✖ (hooks may import types/utils, not UI)  
- `schemas → hooks` ✖  

Use `eslint-plugin-import` (or similar) with explicit `zones` / `boundaries`. Overlaps Section A item 12.

---

### 23. Kill `screenData` as a giant bag (long term)

**Today:** `screenData.game.state`, `screenData.profile…`, `screenData.feed…` spreads knowledge of one mega-object.

**Direction:** domain hooks that slice the same backing data, e.g. `useGame()`, `useProfile()`, `useFeed()`—**same source**, smaller mental chunks (pairs with B5/B7). Not necessarily multiple API calls; often selectors over context.

---

### 24. Introduce a UI contract layer

**Today:** `API → adapters → screenData → UI`

**Target:** `API → adapters → UIModel (contract) → UI`

The contract is the stable shape the UI expects; adapters absorb backend churn. Names and fields can stay close to today’s `ScreenData` at first—the win is an **explicit boundary** and tests against the contract, not against raw API types.

---

### 25. Surface ownership rule

Each surface owns **one** concern:

- `LobbySurface` → lobby only  
- `GameSurface` → game only  
- `ProfileSurface` → profile only  

**No cross-surface logic** (e.g. host pacing leaking into `GameSurface` should move to shared hooks, context, or a dedicated host-controls strip owned by lobby/router policy).

---

### 26. Ban conditional layout policy in `App`

**Today:** e.g. `player.joined ? <GameSurface /> : <Join />` in `App`.

**Target:** routers own “what screen.” `App` only composes shell:

`AppHeader` → `Router` (launcher / host / room) → `BottomNav` → sheets.

Overlaps B2 and B10; makes “where do I add a branch?” obvious.

---

### 27. State derivation layer

Derived UI state (e.g. default tab from `game.state`) must not live as inline ternaries in `App`.

**Target:** pure functions such as `deriveActiveTab(gameState)` (or `useDerivedRoomUi`) in one module, unit-tested. Centralizes policy and shrinks `App` / controller.

---

### 28. Define a UI stability boundary

**Above surfaces:** allowed to churn (routers, hooks, adapters).

**Below primitives:** keep **stable** (props, class contracts, accessibility). Refactors in hooks/surfaces should not constantly rewrite primitives.

Document this so “safe refactor” has a shared meaning.

---

### 29. Replace scattered booleans with capability objects

**Today:** `hostRoomGameControls`, `showTabs`, `showInviteLinks`, etc.

**Target:** a single (or layered) object, e.g. `uiCapabilities = { canStartGame, canInvite, canControlHost, … }`, produced by derivation layer (C27). Scales better than N independent flags and reads as product intent.

---

### 30. “Render path” comment at top of shell

At the top of `App` / `AppView`, a short ASCII tree of the real hierarchy, e.g.:

```text
App
 └─ AppHeader
 └─ RoomRouter
     ├─ LobbySurface
     ├─ GameSurface
     └─ ProfileSurface
 └─ BottomNav
 └─ InviteSheet
```

Update when structure changes. High leverage for onboarding (pairs with Section A item 1).

---

### Architecture rules document (regression guard)

Section A covered **docs**; Section B **refactors**; Section C **rules**. To prevent drift, maintain **[`ARCHITECTURE_RULES.md`](./ARCHITECTURE_RULES.md)** as the short, reviewable list: banned patterns (nested ternaries in shell, cross-surface imports, business logic in `App`, deep `screenData` access, prop drilling past two levels, etc.). Link it from `README` and PR template.

---

### Priority order (true impact — do these first)

Order reflects **preventing complexity from returning**, not only one-time cleanup:

1. **Folder boundaries** (C22) — lint-enforced.  
2. **One-direction data flow** (C21) — team norm + review.  
3. **Router-only `App` / no layout branching in shell** (C26 + B2).  
4. **UI contract layer** (C24) — stabilize UI vs API.  
5. **Break up `screenData` access** (C23) — longer-term; after context/selectors exist.

Items B1/B5 remain the best first *code* steps once boundaries are agreed.

---

## Section D — UI self-discoverability in DevTools

Goal: anyone with Elements open can see **where** they are, **what** owns the subtree, and **which** state drove the view—without reading source first.

Full convention reference: **[`ui-devtools-conventions.md`](./ui-devtools-conventions.md)**.

| # | Idea | Summary |
|---|------|---------|
| D1 | Semantic surface roots | `className="surface surface--lobby"` + `data-surface="lobby"` on each surface root |
| D2 | Component identity | `data-ui="BottomNav"` / `LobbySurface` / `Feed` / `Composer` on major components |
| D3 | Schema node markers | In `RenderNode`: `data-node`, `data-bind`, `data-node-id` from `LayoutNode` |
| D4 | State markers | `data-game-state`, `data-joined`, `data-host`, `data-tab` where stable |
| D5 | Hook / source marker | `data-source="player-screen"` etc. on provider or surface root |
| D6 | Layout boundary classes | `layout-shell`, `layout-header`, `layout-content`, `layout-panel`, … |
| D7 | Debug overlay | `?debug=ui` toggles floating labels for surfaces/components |
| D8 | Surface slots | `data-slot="header" \| "body" \| "footer"` for insertion points |
| D9 | Tab markers | `data-tab` on nav buttons (pairs with BottomNav test ids) |
| D10 | Interaction markers | `data-action="join"` / `submit` / `start` on primary affordances |
| D11 | Feed post kind | `data-post-kind` on feed rows for system vs player vs clue |
| D12 | Surface file header | JSDoc block: Surface name, owns, reads, writes |
| D13 | CSS naming | Prefixes: `surface-*`, `panel-*`, `component-*` for scan-ability |
| D14 | `ui()` helper | `spread ui('GameSurface')` → `{ 'data-ui': 'GameSurface' }` to reduce friction |
| D15 | Path breadcrumbs | `data-path="room.game.feed"` on nested roots for hierarchy search |
| D16 | Debug outlines | Optional CSS outlines per surface in debug mode |
| D17 | Handler markers | `data-handler="submitMove"` mirroring wiring (not replacing test ids) |
| D18 | Data bind markers | `data-bind="game.title"` on bound fields where useful |
| D19 | Body / root mode | `document.body` or `#root` `data-mode`, `data-host` for global context |
| D20 | Search index comment | HTML comment in shell listing surfaces/components for Cmd+F |

### Minimal set (highest ROI — implement first)

Add only these five attributes consistently:

1. `data-surface` — surface root  
2. `data-ui` — major component name  
3. `data-tab` — active or button tab where relevant  
4. `data-game-state` — `SCHEDULED` \| `PLAYING` \| … where available  
5. `data-action` — primary actions (join, submit, start, …)

**Estimated impact:** order-of-magnitude easier debugging in Elements + better alignment with E2E selectors.

---

*End of proposal.*
