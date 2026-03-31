## Gameplay redesign plan (Playability → Great UX)

This document defines the intended gameplay and the UI/data changes needed to achieve it, while keeping the **canonical E2E gate** as the only pass/fail signal.

### Non‑negotiable constraints

- **Server authoritative**: joins, act, submissions, events, unlocks, visibility.
- **JSON authoritative**: characters, acts, puzzles, cards (content).
- **Frontend is a renderer**: no local simulation, no client unlock logic, no client act state.
- **Acceptance metric**: `npm run test:e2e` stays green.

---

## 1) Intended gameplay model (MVP)

### Core loop (per act)

- **Host** starts the game → Act 1 begins.
- **Players** join their character slot.
- Each act, each player receives:
  - **Gameplay cards** (do-now actions; “game cards”)
  - **Assigned clues** (private, character-specific)
  - **Puzzles** (shared or per-player, depending on story)
- Players can **submit** specific cards (MVP: gameplay cards, and optionally puzzle submissions later).
- Submissions write **append-only events**.
- Unlocks/reveals become visible based on:
  - current act
  - events (what was submitted)
  - story rules (JSON/RuntimeStory)
- Host advances act → new act content becomes visible.

### What players should NOT see

- Not “all clues for everyone”.
- Not future-act content.
- Not content for other characters (unless explicitly public/shared).

---

## 2) Runtime contract (authoritative visibility rules)

### RuntimeStory (server-side)

We continue to use:

- `RuntimeStory`
- `RuntimeCard.intent`: `instruction | clue | puzzle | reveal | info`
- `card.act` for act gating

### Visibility policy (must be server enforced)

For each request to build a player view:

- **Act gating**: a card is eligible if `card.act <= currentAct`.
- **Reveal gating**: reveal cards can be additionally gated by solved/submission events.
- **Ownership gating** (critical):
  - Cards that are private must carry an explicit owner or target.
  - If generator does not emit ownership yet, use a deterministic assignment shim to avoid “everyone sees everything”, but treat it as temporary.

### Submission policy (MVP)

- Submittable cards:
  - **Gameplay cards** (`intent=instruction`, source `card_type=game_card`)
  - (Optional later) puzzle answer submissions
- Not submittable:
  - clue cards
  - reveal cards
  - info/host speech

---

## 3) Player UI redesign (tabs + sections)

Goal: eliminate information overload by separating “where am I” from “what do I do” from “who am I”.

### Tabs (player) — locked naming + mental model

- **Now** (primary surface)
  - Answers: **What is happening now?** **What should I say/suspect next?**
  - Stage (state + act)
  - Room players list (always show character name; join status separately)
  - Feed (short, scannable)
  - Composer (attached to feed)
  - **Evidence this act** (read-only, under Now)
    - private clues (assigned to this character, per act)
    - puzzles (shared or private, per story)
    - reveals (newly unlocked)
- **Do** (action surface)
  - Answers: **What do I need to do?**
  - Gameplay cards only (submit-capable)
  - Clear split: **Do now** (incomplete) vs **Submitted** (history)
- **Role** (private surface)
  - Answers: **Who am I and how should I roleplay?**
  - Character biography, secrets, private items (if present)

**Locked**: Evidence is under **Now** (not a 4th tab yet).

**Language rule**: Avoid “Cards” as a UI tab label. It’s a storage term; the player mental model is Now / Do / Role.

### “Everything looks like the same card” — container styles (locked)

We will intentionally differentiate containers so scanning is effortless on a phone.

### Media primitive (locked)

Support both remote + local from day one (treated identically by `Media`):

- `https://…` remote URLs
- `/assets/...` relative static paths
- imported assets (`import img from ...`)
- data URLs (future-safe)

Final primitive (locked):

```ts
type MediaProps = {
  kind?: 'image' | 'video' | 'audio'
  src?: string
  poster?: string
  alt?: string
  ratio?: '16:9' | '4:3' | '1:1' | 'auto'
  variant?: 'hero' | 'card' | 'thumb'
  fit?: 'cover' | 'contain'
  priority?: boolean
  sizes?: string
  role?: 'decorative' | 'content' | 'avatar'
  fallback?: {
    type: 'gradient' | 'initials' | 'icon'
    label?: string
  }
  onClick?: () => void
}
```

Defaults:

- narration → `hero` + `16:9`
- evidence → `card` + `auto`
- feed thumb → `thumb` + `1:1`
- avatar → `thumb` + `1:1` + `initials`

Priority rules:

- narration hero → `true`
- avatars → `false`
- evidence → `false`

Role rules:

- narration hero → `decorative`
- evidence → `content`
- avatar → `avatar`

Rendering rules (must-haves):

- Always reserve space via ratio wrapper
- Load `<img>` inside container
- `onError` → fallback (no layout shift)
- Lazy load by default
- Subtle loading state (no blank)
- No autoplay yet (future video)

Fallback styling:

- gradient → narration / story
- icon → missing evidence
- initials → avatars / players

- **Feed items** (primary narrative + deduction surface)
  - **Narration** (host speech, act transitions): cinematic card (supports imagery)
  - **Social** (suspicions, accusations, alibis, claims): speech-bubble style, compact
  - **Mechanics** (objective submitted, puzzle solved, unlock/reveal): badge-forward, scannable, compact
  - **Room** (player joined, act advanced, timer warnings): muted system strip (smallest)
- **Do items** (gameplay cards)
  - “Text message sized” rows: tight padding, single clear call-to-action, intent badge always visible
  - Completed state must be obvious at a glance (visual dimming + ordering; no re-implementation of logic)
- **Evidence items** (clues/puzzles/reveals)
  - Slightly heavier layout than Do rows (these can be longer)
  - Default clamp with “Read more”, preserve paragraph formatting (`pre-wrap`)

### Element language (visual grammar) — locked

We will use a consistent “visual grammar” so players can identify meaning **before reading**.

**Primitives**

- **Surface**: full-screen context (Now / Do / Role). Each surface answers one primary question.
- **Rail**: horizontal presence strip (people). Always feels “social”, never looks like content cards.
- **Panel**: groups a unit of meaning (Stage, Feed, Evidence).
- **Row**: “text message sized” item (feed row, do-now objective row). Fast scanning, minimal chrome.
- **Badge**: tiny semantic label (intent + state). The iconography of meaning.

**Action affordance rules**

- Only actionable items show a right-side action affordance (button column).
- Evidence is read-only unless explicitly marked; avoid “fake buttons”.
- Submitted state must never visually compete with Do-now state.

**Feed variants**

- `narration`: story delivery (cinematic)
- `social`: player speech (bubble)
- `mechanic`: state changes (scannable event row)
- `room`: awareness (muted strip)

### Card interaction rules (player)

- Gameplay cards show a **Submit** action with:
  - in-flight disable
  - “Submitted” state
  - clear helper “Posts to the room feed”
- Clues are read-only (no submit).
- Puzzles are read-only in MVP unless/until a puzzle submission UX is added.

### Presence + avatars (scope lock)

- **Phase B (now)**: improve presence with **fallback avatars** (no camera) and clear join/online status.
- **Phase B.5 (optional)**: add a small “presence rail” strip under Now for room awareness.
- **Phase C+ (explicitly out of scope for now)**: live camera/video tiles and active-speaker focus, pending a tech decision.

---

## 4) Host UI redesign (clarity + control)

Goal: host always knows “what to read” and “what to do”.

### Host layout

- Stage (state + act)
- “Read this now” (host speech for current act)
- Room feed (joins, submissions, act starts)
- Controls:
  - Start game
  - Next act
  - End night (later)

---

## 5) Data shape fixes required (server → view models)

### PlayerView must contain

- `roomPlayers[]` with:
  - `characterName` (always)
  - `playerName` (optional)
  - `joinedAt` (join status)
- Distinct lists for:
  - gameplay cards (instruction/game_card)
  - assigned clues
  - puzzles
  - reveals

### Replace “puzzles == newThisAct”

Currently, “newThisAct” is overloaded and can make puzzle cards appear wrong.

Target model:

- `unlockedCards`: gameplay + clues + reveals (with clear `type`)
- `unlockedPuzzles`: puzzle cards only (with `intent='puzzle'`)
- `newThisAct`: derived display list (client-side) from the above, not the source of truth

---

## 6) Implementation phases (safe, test-gated)

All phases keep `npm run test:e2e` green.

### Phase A — Fix data correctness (highest priority)

- Enforce per-player visibility server-side (ownership + act gating).
- Ensure gameplay cards exist and are visible.
- Fix puzzle vs clue vs reveal categorization in player view.
- Fix lobby naming: always show character name; join is separate.

### Phase B — Restore player tabs + reduce overload

- Reintroduce player tabs (Now / Do / Role).
- Move lists into the correct surface (Evidence under Now; submit-capable gameplay cards under Do).
- Reduce scan cost: “text message sized” Do rows and differentiated feed container styles.

### Phase C — Interaction polish (only after correctness)

- Clear submit affordances for gameplay cards.
- Visual intent badges and consistent card typography.
- Feed wording and density improvements.

---

## 7) E2E coverage targets (expand only when needed)

We already gate:

- pregame waiting visible
- refresh resilience
- 2-player join
- start propagation
- act 1 content visibility
- submit → host feed → reveal
- advance to act 3

Additions should only be made when a real playtest risk is found (avoid test sprawl).

