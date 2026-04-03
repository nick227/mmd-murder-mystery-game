# Real-Time Feed Proposal

## Goal

Make the unified lobby feed appear live across all connected clients when any player or host creates a game event:

- player joins
- player posts to the feed
- player submits an objective/card
- host starts the game
- host advances the act
- host ends or finishes the game

The feed already has a strong canonical source of truth: `gameEvent` rows in the API database. The main question is transport, not data modeling.

## Current State

### Feed authority

The API already persists feed-worthy actions as `gameEvent` records:

- `JOIN` in `mmd-api/src/routes/players.ts`
- `SUBMIT_OBJECTIVE` in `mmd-api/src/routes/players.ts` and `mmd-api/src/routes/games.ts`
- `POST_MOVE` in `mmd-api/src/routes/games.ts`
- `START_GAME` and `ADVANCE_ACT` in `mmd-api/src/routes/games.ts`

Both player and host views rebuild from event history:

- player view returns `feed: player.game.events` in `mmd-api/src/routes/players.ts`
- host view returns `feed: game.events` in `mmd-api/src/routes/games.ts`
- frontend maps those API events into display feed items in `mmd-frontend/src/data/screenData/playerScreenModel.ts`

This is good. We do not need a second feed model for real-time.

### Current refresh behavior

The frontend is polling today:

- player room view reloads every 8 seconds in `mmd-frontend/src/hooks/useAppState.ts`
- host room view reloads every 5 seconds in `mmd-frontend/src/hooks/useAppState.ts`

It also does immediate fetches after mutations:

- objective submit calls the API and then `reloadInternal()`
- join calls the API and then `reloadInternal()`
- host actions call the API and then `reloadInternal()`

Composer posts are optimistic for the sender only:

- sender sees the post immediately via optimistic local state
- everyone else waits for the next poll

### Practical effect

The app is eventually consistent, not real-time:

- a host start can take up to 8 seconds to reach players
- a player post can take up to 5 seconds to reach the host and 8 seconds to reach other players
- every active tab keeps hitting the full view endpoints even when nothing changes

## End-to-End Feed Assessment

### What is already solid

- The feed is canonical and append-only at the data level.
- Both player and host screens derive from the same event history.
- The lobby feed is now the single player-facing timeline.
- Optimistic composer posts already solve local responsiveness for the sender.

### Current weaknesses

- Polling reloads the whole screen model, not just incremental feed changes.
- Player and host intervals are asymmetric, so state propagation timing is inconsistent.
- Every client repeatedly fetches even when there are no updates.
- Polling is doing double duty for feed sync and phase/state sync.
- Real-time behavior is most noticeable at the exact moments that matter most: start, act changes, and submissions.

## Options

## Option 1: Keep polling, tune it

### What it means

Stay on HTTP polling and improve the cadence/behavior:

- reduce player interval from 8s to 2-3s while game is active
- keep scheduled lobbies slower, for example 5-10s
- reload immediately after browser tab visibility returns
- optionally add a cheap lightweight version check endpoint before full reload

### Pros

- lowest implementation risk
- no new server infrastructure
- easy to ship quickly
- works fine for small playtests

### Cons

- still not truly live
- still wastes requests when idle
- phase changes can still feel delayed
- scales poorly with more concurrent rooms and tabs

### Verdict

This is acceptable only as a short-lived stopgap.

## Option 2: Server-Sent Events for room updates

### What it means

Add a one-way push stream per room:

- clients open an `EventSource` to subscribe to room updates
- server publishes when a new `gameEvent` row is created or game state changes
- client receives a small update envelope and triggers a targeted reload or merges the new event

Example event payload:

```json
{
  "type": "feed_event",
  "gameId": "game_123",
  "eventId": "evt_456",
  "eventType": "POST_MOVE",
  "createdAt": "2026-04-02T09:00:00.000Z"
}
```

### Why SSE fits this app

Our real-time need is server-to-client fanout. Clients are already sending writes over normal POST endpoints. We do not need duplex messaging for chat presence, typing, or in-browser game simulation.

That makes SSE a better fit than WebSockets right now:

- simpler operational model
- native browser support
- easier reconnect semantics
- lower implementation surface than full socket session management

### Pros

- near real-time updates for all clients
- minimal protocol complexity
- leaves current POST endpoints unchanged
- can start by triggering `reloadInternal()` on push before attempting incremental merging

### Cons

- still requires connection lifecycle work on the API
- host auth and player auth need careful subscription rules
- if we only use SSE to trigger a full reload, payload efficiency improves less than UX

### Verdict

This is the best next-step real-time solution if we want live updates soon without overbuilding.

## Option 3: WebSockets

### What it means

Add a socket server and room subscriptions:

- client connects over WS
- client authenticates as host or player for a room
- server broadcasts event payloads to subscribed room members
- client applies updates in memory

### When WebSockets are justified

WebSockets become worth it if we plan to add any of the following soon:

- private/direct roleplay channels
- typing indicators
- live presence
- host control events that must acknowledge instantly
- client-side collaboration features beyond the feed
- lower-latency bidirectional gameplay

### Pros

- most flexible long-term transport
- full duplex communication
- can support future live multiplayer features beyond the feed

### Cons

- highest implementation and testing cost
- requires connection management, auth, reconnect logic, and room cleanup
- more moving parts than this feed currently needs
- not supported by existing API setup today

### Verdict

WebSockets are not worth the effort for the feed alone right now.

## Recommendation

Do not build WebSockets now.

Build a staged solution:

1. short term: tighten polling and trigger reloads more deliberately
2. medium term: add SSE for room-level update notifications
3. later: revisit WebSockets only if we commit to richer bidirectional real-time features

This recommendation is based on fit, not conservatism. The current product need is broadcast notification of authoritative server events. SSE solves that cleanly. WebSockets solve a larger problem than we currently have.

## Recommended Architecture

### Phase 0: improve polling immediately

Before adding a push transport:

- reduce active player polling from 8s to 3s during `PLAYING`
- keep host polling at 3s or 5s, but make it symmetric with players where practical
- poll slower in `SCHEDULED` and `REVEAL`
- trigger an immediate silent reload on `visibilitychange` when the tab becomes active

This is low effort and improves perceived lag now.

### Phase 1: SSE notification channel

Add a room updates stream:

- `GET /api/v1/rooms/:gameId/stream` for players
- `GET /api/v1/games/:gameId/host/stream` for hosts, or a shared room stream with auth modes

The server should emit small events whenever these writes succeed:

- join
- objective submission
- post move
- start game
- advance act
- end night
- finish game

The first implementation should be conservative:

- SSE event received
- client calls `reloadInternal({ silent: true })`

That keeps server truth authoritative and avoids incremental merge bugs.

### Phase 2: optional incremental patching

Once SSE is stable, optimize client behavior:

- append incoming feed items directly when safe
- update act/state fields directly for start/advance events
- fall back to full reload on reconnect or unknown event types

This should only happen after the transport is proven stable.

## Authentication and Subscription Model

We should not expose a public room stream keyed only by `gameId`.

Recommended access model:

- player stream authenticates by `characterId` route context already in use by room URLs
- host stream authenticates with `x-host-key`

Safer alternatives:

- player stream endpoint includes `characterId`
- server validates that the player slot exists before subscribing

We do not need per-user identity beyond room membership for feed fanout.

## Server Design Notes

### Event source of truth

Do not create a second in-memory-only event model. The DB write remains the authoritative mutation.

After any successful `prisma.gameEvent.create(...)` or game-state transition:

- publish a lightweight notification to connected subscribers for that game
- include event id and event type
- optionally include `currentAct` and `gameState`

### Fanout mechanism

Keep the first version process-local:

- in-memory `Map<gameId, Set<connection>>`
- broadcast after successful write

This is good enough for local dev and a single API instance.

If we later run multiple API instances, we will need cross-instance fanout:

- Redis pub/sub
- Postgres `LISTEN/NOTIFY`
- or a managed realtime service

That is a later scaling concern, not a blocker for phase 1.

## Client Design Notes

### Minimal client behavior

Add a room subscription hook used by both host and player screens:

- connect on mount when `apiBase` and `gameId` are known
- reconnect with backoff if disconnected
- on event, call silent reload
- suspend or disconnect when the page is hidden if needed

### Why not merge events immediately on day 1

The screen model is derived from more than feed rows:

- stage title and image change with act
- objective completion state depends on server events
- evidence and reveal visibility depend on act and solved state

A simple push-triggered reload is safer than hand-merging all those projections on the first pass.

## Cost vs Value

### Polling-only path

- implementation cost: low
- UX improvement: low to medium
- long-term quality: weak

### SSE path

- implementation cost: medium
- UX improvement: high
- long-term quality: strong for current requirements

### WebSocket path

- implementation cost: high
- UX improvement for feed only: medium to high
- long-term quality: strong only if broader real-time features are coming

## Decision

If the question is "should we implement WebSockets now for the feed," the answer is no.

If the question is "should we move beyond polling now," the answer is yes.

The best path is:

- ship a short-term polling cleanup immediately
- implement SSE-based room update notifications next
- defer WebSockets until we need bidirectional live features beyond feed fanout

## Proposed Execution Order

1. Normalize polling intervals and add visibility-triggered reload.
2. Add API-side room subscription support with SSE.
3. Add a frontend room subscription hook that triggers silent reloads.
4. Update E2E tests to assert cross-client propagation without manual sync waits.
5. Reassess whether incremental patching is worth doing after SSE is stable.

## Success Criteria

- a player post appears on host and other player clients within about 1 second
- host start and act changes appear on all player clients without waiting for poll cadence
- feed remains server-authoritative after reconnects
- no duplicate feed entries from optimistic composer reconciliation
- no second feed model is introduced
