# UI DevTools conventions (MMD frontend)

Conventions so the DOM is **self-describing** in Chrome/Firefox DevTools. Use with [Section D of the maintainability proposal](./fe-maintainability-proposal.md).

## Quick search (DevTools → Elements → search box)

Use these to jump straight to the live shell and key widgets:

```text
[data-surface="game"]
[data-ui="ComposerPanel"]
[data-action="post"]
[data-mode="room"]
```

`data-game-state` (e.g. `SCHEDULED`, `PLAYING`) lives **only** on the app shell next to `data-surface`—see below.

---

## Single owner: `data-surface` + `data-game-state`

**One place only:** the root shell `div.app-shell` in **`AppView.tsx`**:

- `data-ui="App"` (matches the default export name **`App`** in `App.tsx`, rendered via **`AppController`** → **`AppView`**)
- `data-surface` — current high-level screen: `launcher` \| `host` \| `lobby` \| `game` \| `profile`
- `data-game-state` — `ScreenData.game.state` (same value everywhere in the app; no duplicates)

Do **not** put `data-game-state` on `PageRenderer`, `Stage`, or inner `Surface` roots. Inner `<main class="surface surface--…">` keeps **CSS** classes `surface surface--lobby|game|profile` for styling but **no** `data-surface` attribute (avoids nested/conflicting markers).

**Global routing:** `document.body` has `data-mode="launcher" | host | room` (from `useViewMode`).

---

## `data-ui` naming (strict)

Use the **exported component name** from its `.tsx` file (PascalCase), e.g. `GameSurface`, `BottomNav`, `Feed`, `ComposerPanel`, `Stage`.

Avoid kebab-case or role names (`game-feed`, `composer-panel`) so names stay tied to source files and do not drift.

The top shell uses `data-ui="App"` only once. Do not repeat `data-ui="App"` on inner wrappers.

Helper: `src/utils/uiMarkers.ts` — `ui('ComponentName')`.

---

## `data-action` (verbs only)

Use verbs: `join`, `post`, `start`, `finish`, `reload`, `invite`, `advance`, …

Host pacing buttons use action **ids** in code (`start`, `next`, `finish`); `data-action` maps `next` → `advance` via `actionVerb()` in `uiMarkers.ts` so the DOM stays verb-only.

Avoid nouns as actions (`composer`, `feed`, `button`).

---

## Minimal attribute set (wiring)

| Attribute | Where | Notes |
|-----------|--------|--------|
| `data-surface` | App shell only | `launcher` \| `host` \| `lobby` \| `game` \| `profile` |
| `data-ui` | Major components | File/export name |
| `data-tab` | Bottom nav buttons + shell when tabbed | `lobby` \| `game` \| `profile` |
| `data-game-state` | App shell only | Mirrors `game.state` |
| `data-action` | Primary actions | Verbs; see `actionVerb` for id → verb |

---

## Implemented (code)

- **`AppView`** shell (`div.app-shell`): `data-ui`, `data-surface`, `data-game-state`, `data-tab` when tabs visible  
- **`body`**: `data-mode`  
- **`Surface`**: `data-ui` = `LobbySurface` \| `GameSurface` \| `ProfileSurface`; CSS classes `surface surface--*`; **no** `data-surface` / `data-game-state`  
- **`BottomNav`**, **`Feed`**, **`ComposerPanel`**, **`PresenceRail`**, **`Stage`**, **`BottomSheet`**  
- **ActionsBar**: `data-action={actionVerb(item.id)}`  
- Join / launcher / invite / reload: `join`, `start`, `invite`, `reload`, composer `post`  

---

## Declarative layout (`RenderNode`) — optional future

| Attribute | Source |
|-----------|--------|
| `data-node` | `LayoutNode.type` |
| `data-node-id` | `LayoutNode.id` |
| `data-bind` | `LayoutNode.bind` |

## Review checklist

- [ ] `data-game-state` / `data-surface` only on app shell  
- [ ] `data-ui` matches exported component filename  
- [ ] `data-action` is a verb; use `actionVerb()` when mapping from ids  
- [ ] No PII in `data-*` values  
