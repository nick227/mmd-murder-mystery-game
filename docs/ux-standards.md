## UX standards (mobile-first)

These standards define the “beautiful default” for the Murder Mystery UI. Optimize for **phone readability**, **fast scanning**, and **consistent rhythm**. Prefer updating existing primitives/styles over adding new one-off UI.

### Layout + spacing

- **App width**: mobile-first, centered, max-width **480px** (`.app-shell`).
- **Primary stack rhythm**:
  - **screen stack gap**: 12px (`.screen-stack`)
  - **panel padding**: 14px (`.panel`)
  - **internal lists/sections gap**: 10px (`.section-stack`, `.list-block`, `.feed-list`, etc.)
- **Panels**: always use `.panel` for card-like containers:
  - radius **20px**
  - border `1px solid var(--line)`
  - soft shadow (consistent across the app)
- **Avoid ad-hoc margins**: use stack containers with `gap` instead of random `margin-top` unless needed for small, local adjustments.

### Typography + readability

- **Body text**: keep at ~16px equivalent with line-height **≥ 1.45** for paragraphs and card bodies.
- **Hierarchy**:
  - **H1**: stage title only
  - **H2**: panel titles
  - **Meta**: small + muted (`.panel__meta`, ~.78–.85rem)
- **Long text formatting**:
  - Preserve paragraph breaks (`white-space: pre-wrap` for card bodies).
  - Clamp long card bodies by default; offer **Read more / Show less**.

### Color system (tokens only)

- **No raw hex in components**: use CSS variables from `:root`.
- **Core tokens**: `--bg`, `--panel`, `--panel-2`, `--text`, `--muted`, `--line`.
- **Semantic tokens**: `--accent`, `--accent-2`, `--danger`.
- **Contrast**:
  - Primary text uses `--text` on panel backgrounds.
  - `--muted` is only for secondary/supporting text (meta, helper text).
- **Semantic surfaces**: prefer subtle tints (not solid blocks) for announcements/highlights.

### Reusable patterns

- **Panel header**: title left, meta right (`.panel__header`, `.panel__meta`).
- **Stack everywhere**: prefer wrapper stacks with `gap` over manual spacing.
- **Sticky actions**: actions remain reachable and never obscure content (`.actions-bar`).

