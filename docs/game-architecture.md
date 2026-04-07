**Game Architecture (Frontend)**

**Purpose**
This document explains how the front end drives game play and UI using `useHostScreenData.ts`, `usePlayerScreenData.ts`, and `screenBuilders.ts`, with emphasis on state, effects, and event mapping (including `mapApiEventToProgressFeedItem`).

**High-Level Data Flow**
1. Routing selects a mode (`launcher`, `host`, `room`) and passes `apiBase`, `gameId`, `hostKey`, and `characterId`.
2. The relevant hook (`useHostScreenData` or `usePlayerScreenData`) fetches data from a `gameSource` implementation.
3. The hook builds a `ScreenData` model and returns it + `RendererHandlers`.
4. `AppView` renders the UI based on `ScreenData` and uses handlers for user actions.
5. Streams + polling keep state in sync with server-side events.

**Key Design Idea**
The UI does not read the API directly. It renders a normalized `ScreenData` model. Hooks are responsible for:
1. Data fetching and subscriptions.
2. Translating API responses into UI-ready `ScreenData`.
3. Providing handlers to mutate server state and update local state.

---

**Host Flow: `useHostScreenData.ts`**

**Inputs**
- `apiBase`, `gameId`, `hostKey`

**State**
- `screenData`: the normalized host view.
- `loading` / `error`: API call status.
- `streamConnected`: whether the event stream is active.
- `queuedPushReloadRef`: debounced reload for stream events.

**Effect Model**
- Reset on missing `gameId`/`hostKey` (clears data).
- Initial load + polling (intervals vary by game state + stream status).
- `visibilitychange` triggers a silent refresh when returning to the tab.
- Stream subscription pushes a debounced reload.

**Screen Construction**
- `buildHostScreen(game, apiBase)` in `screenBuilders.ts` builds the host `ScreenData`.
- Host feed is created from a system entry + mapped API events.
- Host actions are derived from game state (`SCHEDULED`, `PLAYING`, `REVEAL`, `DONE`).

**Handlers**
- `onAction`: sends host actions (`start`, `next-act`, `reveal`, `done`) to API.
- `onObjectiveToggle`: local-only toggle for host checklist items.
- `onCopyText`: clipboard helper.

---

**Player Flow: `usePlayerScreenData.ts`**

**Inputs**
- `apiBase`, `gameId`, `characterId`

**State**
- `screenData`: normalized player view.
- `view`: raw `PlayerApiView` response.
- `loading` / `error`
- `streamConnected`
- `joinDraft`: text for join name.
- `optimisticComposerPosts`: pending local chat posts.
- Refs used for concurrency and optimistic flow:
  - `requestIdRef`: guards against out-of-order responses.
  - `composerDraftRef`: keeps latest draft.
  - `isSendingComposerRef`: prevents double-send.

**Effect Model**
- Reset on missing `gameId`/`characterId`.
- Initial load + polling (custom schedule when stream is disconnected).
- `visibilitychange` triggers a silent refresh.
- Stream subscription triggers debounced reload.
- Optimistic post cleanup when server acknowledges the post.

**Screen Construction**
- `buildPlayerScreenModel(view, joinDraft)` builds the base player `ScreenData`.
- The feed is then merged with optimistic posts so the UI updates immediately.

**Handlers**
- `onJoinSubmit`: posts join action and reloads.
- `onObjectiveSubmit`: toggles UI state then persists to API.
- `onComposerSend`: posts a message with optimistic UI.

---

**`screenBuilders.ts`**

**Role**
`screenBuilders.ts` translates host API data into `ScreenData` for host mode.

**Key Outputs**
- `game`: host view header data, banners, countdown, etc.
- `players`: display list with joined status.
- `feed`: system summary + mapped API events.
- `objectives`: host checklist.
- `gameActions`: host control buttons.
- `hostInfo`: player links and host metadata.

---

**Event Mapping: `mapApiEventToProgressFeedItem`**

**Where It’s Used**
1. `buildHostScreen`: maps `game.feed` events to host progress feed items.
2. `buildPlayerFeed` (in `playerScreenModel.ts`): maps events into the player feed.

**Why It Matters**
The feed is a shared, uniform UI component for different event types. This function:
- Normalizes event payloads into `FeedItem`s.
- Controls visual variants (narration, room, mechanic, social).
- Inserts act dividers for `START_GAME` and `ADVANCE_ACT`.
- Uses `clientRequestId` as the item id for `POST_MOVE` to reconcile optimistic posts.

This is the “event → UI” translation layer.

---

**State + Effects: How the UI Stays in Sync**

**Polling + Streaming**
- Both host and player hooks use polling as a fallback.
- When the stream is connected, polling intervals are reduced.
- Stream events trigger a debounced reload to avoid thrashing.

**Visibility Awareness**
When the document becomes visible, a silent reload fires. This keeps the UI fresh after tab switches or sleeping devices.

**Concurrency Guard**
`requestIdRef` in `usePlayerScreenData` ensures only the latest request updates state, preventing stale updates from slow responses.

---

**Decentralized Event Keys (Client Request IDs)**

**What They Are**
For chat posts, the client generates `clientRequestId` (via `crypto.randomUUID()`), which is:
- Sent to the API (`postMove`).
- Used as the feed item id for optimistic UI.
- Echoed back by the server in event payloads.

**Why It’s “Decentralized”**
The client, not the server, supplies the event key. This lets the UI:
- Render a post immediately.
- Later reconcile it when the server acknowledges it in the feed.

**Effect on UI**
- Optimistic posts render instantly.
- When the server confirms the event, `readClientRequestId` removes the optimistic placeholder.
- The final server event uses the same id, preventing duplicates.

This is the key mechanism for responsive chat without waiting on a round-trip.

---

**System Design Summary**

**Screen Model Layer**
- `ScreenData` is the contract between data and UI.
- Host and player hooks adapt API responses into `ScreenData`.

**Event-Driven Feed**
- API event stream is mapped into feed items.
- The same mapping is reused for host and player views.

**Optimistic UX**
- Player chat posts are optimistic by default.
- `clientRequestId` reconciles UI and server state.

**State-Driven Rendering**
- UI is pure: it renders `ScreenData` and calls handlers.
- Hooks control side effects and synchronization.

---

**Files**
- `mmd-frontend/src/hooks/useHostScreenData.ts`
- `mmd-frontend/src/hooks/usePlayerScreenData.ts`
- `mmd-frontend/src/hooks/screenBuilders.ts`
- `mmd-frontend/src/data/screenData/playerScreenModel.ts`
- `mmd-frontend/src/hooks/optimisticComposer.ts`
