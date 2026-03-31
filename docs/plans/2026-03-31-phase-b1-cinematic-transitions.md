## Phase B.1 — cinematic transitions + stacking (locked)

### Decisions

- **Overlay text**: Stage-sourced (no schema changes)
- **Act transitions**: full-width cinematic divider for `START_GAME` / `ADVANCE_ACT`
- **Narration stacking**: group consecutive narration; collapse spacing
- **Room strips**: never interrupt narration blocks (render after the block)
- **Reveal bridge**: reveal + image → cinematic panel; reveal without image → evidence row
- **Reveal emphasis**: explicit “Reveal” badge + subtle new-act glow

### Rendering rules

#### Act transition

- full-width cinematic panel
- label: `ACT {n}`
- hero media if present
- fade-in once

#### Narration stacking

- consecutive narration items collapse spacing
- extra gap before/after non-narration
- room items render after narration block

#### Reveal bridge

- reveal + image → cinematic panel
- reveal no image → evidence row

#### Overlay text

- title: `ACT {n}`
- subtitle: stage title
- body: stage description
- gradient always behind text

### Implementation location

- **Grouping logic**: adapter/view model
- **Feed renderer**: dumb (renders according to flags)
- **CSS**: spacing + fade + emphasis

