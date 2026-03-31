# Room route: host-as-player (single UI tree) design

**Goal:** Make host literally a player with the same Lobby/Game/Profile surfaces, while enabling host controls via a Host tab when `hostKey` is present — with no separate host/player modes in the product UX.

---

## Final behavior (approved)

### Route

`/room/:gameId/:characterId?hostKey=...`

### Tabs

- Lobby
- Game
- Profile
- Host (**only when `hostKey` is present**)

### Join state handling

- **Pre-join**
  - Lobby shows join card
  - Game disabled / empty
  - Profile placeholder
  - Host tab fully active
- **Post-join**
  - All tabs active

### Host capabilities

When `hostKey` exists in the query string:
- Host tab visible immediately (no join required)
- Host actions enabled (start/next/finish/cancel)
- Invite links accessible
- “Play as” allows switching `:characterId` in the URL (same UI tree)

---

## Backwards compatibility redirects (important)

- `/play/:gameId/:characterId?...` → `/room/:gameId/:characterId?...` (preserve query)
- `/host/:gameId?hostKey=...&api=...` → `/room/:gameId/:characterId?hostKey=...&api=...`
  - **Character selection source**: use per-device saved links (localStorage registry) to pick a reasonable default characterId for that game.
  - If no characterId can be inferred, keep legacy host page as fallback (temporary) with a “Play as” chooser.

---

## Implementation notes (high-level)

- Add `host` to `TabId` and render `BottomNav` for room route.
- Room route always uses player data fetch by character.
- When `hostKey` present, also fetch host view in parallel for Host tab.
- Host tab content uses existing host view components/layouts (no new surface).

