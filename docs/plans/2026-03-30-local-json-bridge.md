# Local JSON Bridge Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Let `mmd-frontend` run from generated story JSON files in `mmd-api/json` (for phone playtests) behind a `GameSource` seam, while keeping UI view models stable and surfacing schema drift.

**Architecture:** Introduce `GameSource` with `ApiGameSource` (wrap existing HTTP functions) and `LocalJsonGameSource` (loads JSON from disk via Vite dev-server endpoints + stores transient game state in `localStorage`). Convert pipeline JSON into **API-shaped** `PlayerApiView` / `HostApiGame` using a dedicated adapter, then reuse existing `playerViewToScreenData`.

**Tech Stack:** React 18, Vite 5, TypeScript, browser `localStorage` (local mode only).

---

### Task 1: Dev-server endpoints for local story files

**Files:**
- Modify: `mmd-frontend/vite.config.ts`

**Steps:**
- Add a small Vite dev plugin that serves:
  - `GET /__local_stories` → `{ files: string[] }` from `../mmd-api/json`
  - `GET /__local_story/<filename>` → raw JSON file contents
- Ensure the plugin only runs in dev.

### Task 2: Add `GameSource` seam (API + local)

**Files:**
- Create: `mmd-frontend/src/data/sources/types.ts`
- Create: `mmd-frontend/src/data/sources/apiGameSource.ts`
- Create: `mmd-frontend/src/data/sources/localJsonGameSource.ts`
- Create: `mmd-frontend/src/data/sources/getGameSource.ts`

**Steps:**
- Define a `GameSource` interface matching the app’s needs (`fetchStories`, `createGame`, `fetchHostGame`, `fetchPlayerViewByCharacter`, `joinPlayerByCharacter`, `postHostAction`, `postEndNight`).
- Implement `ApiGameSource` by delegating to existing functions in `src/data/api.ts`.
- Implement `LocalJsonGameSource`:
  - Story list comes from `GET /__local_stories`
  - Story file load comes from `GET /__local_story/<filename>`
  - Store local game state in `localStorage` (game state, act, joins, reveal answers)

### Task 3: Adapter from generated JSON → API-shaped models (+ diagnostics)

**Files:**
- Create: `mmd-frontend/src/data/adapters/generatedStoryAdapter.ts`

**Steps:**
- Parse pipeline JSON `cards[]` and construct:
  - `StoryListItem` list item(s)
  - A deterministic `HostApiGame` with players from `card_type="character"`
  - A per-character `PlayerApiView`:
    - `character` object includes `name`, `archetype?`, `biography?`, `secrets[]`, `items[]`
    - `unlockedCards` and `unlockedPuzzles` derived from pipeline cards by act
    - `stage` derived from `card_type="story_act"` for current act
- Emit diagnostics for:
  - unknown `card_type`
  - cards missing required fields (`card_id`, `card_contents`, etc.)
  - unmapped fields (report key paths at least per-card)

### Task 4: Wire hooks to choose source via query params

**Files:**
- Modify: `mmd-frontend/src/hooks/useAppState.ts`

**Steps:**
- Read query params:
  - `source=local|api` (default `api`)
  - `story=<filename>` in local mode
- Replace direct calls to `src/data/api.ts` with calls to the selected `GameSource`.
- Ensure generated links preserve `source` + `story` so phone URLs work without rebuild.

### Task 5: Lightweight diagnostics visibility

**Files:**
- Modify: `mmd-frontend/src/hooks/useAppState.ts` (or a minimal UI component if needed)

**Steps:**
- In local mode, inject a `FeedItem` (type `system`) summarizing adapter warnings (first N lines).
- Keep messages actionable (include `card_id`, `card_type`, and field path).

### Task 6: Verify in dev

**Steps:**
- Run: `npm install` (if needed) then `npm run dev` in `mmd-frontend`
- Open:
  - Launcher: `/?source=local`
  - After create: host link `/host/<id>?source=local&story=...`
  - Player link `/play/<id>/<characterId>?source=local&story=...`
- Confirm:
  - Story loads from `mmd-api/json`
  - Player screen renders stage/objectives/profile
  - Diagnostics appear when schema mismatches are present

