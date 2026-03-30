# Manual User Testing Guide (Playability Gate)

This guide is for **phone playtesting**. A build is considered **playable** when the **canonical 8-step loop** succeeds end-to-end.

## What “PASS” means

PASS = you can complete all 8 steps below without getting stuck:

1. Host starts game  
2. Player joins  
3. Host sees player joined  
4. Player submits objective  
5. Host sees submission  
6. Reveal card appears for player  
7. Host advances act  
8. Player sees new act

If any step fails (no join, no objective, no reveal, act not advancing, state not syncing), treat it as **not playable**.

## Setup (local network)

- **Devices**: 2 phones (or 1 phone + 1 desktop browser), ideally on the same Wi‑Fi.
- **Backend**: API running (default `http://<your-pc-ip>:3000`)
- **Frontend**: Vite dev server running (default `http://<your-pc-ip>:5180`)

Tip: you’ll use the **launcher** on the frontend to generate a host link and player links.

## Run: Canonical 8-step loop (two phones)

### Step 0 — Create game (Launcher)

On any device:

- Open the frontend launcher: `http://<your-pc-ip>:5180/`
- In **API base**, enter: `http://<your-pc-ip>:3000`
- Select a story
- Tap **Create game**
- Copy:
  - **Host link** (for host phone)
  - **Player link** (for player phone)

### 1) Host starts game

On **Host phone**:

- Open the **host link**
- Tap **Start Game**
- Expected:
  - Stage eyebrow shows **`PLAYING · Act 1`**
  - Room feed includes **“Game started …”**

### 2) Player joins

On **Player phone**:

- Open the **player link**
- Expected:
  - Name input is **autofocused**
- Enter a name and press **Enter** (or tap Join)
- Expected:
  - Join transitions you into the game screen (no manual navigation)

### 3) Host sees player joined

On **Host phone**:

- Tap **Reload**
- Expected:
  - Player shows as joined (joined pill/indicator)
  - Optional: feed may show a join event

### 4) Player submits objective

On **Player phone**:

- Find an objective card
- Tap **Submit**
- Expected:
  - Button shows **Submitting…** briefly, then **Submitted**
  - The card briefly highlights (confirmation flash)

### 5) Host sees submission

On **Host phone**:

- Tap **Reload**
- Expected:
  - Feed includes **“Player 0 submitted an objective.”** (or similar)

### 6) Reveal card appears (player)

On **Player phone**:

- Tap **Reload**
- Expected:
  - A reveal card becomes visible (often marked **New**)

### 7) Host advances act

On **Host phone**:

- Tap **Next Act**
- Expected:
  - Stage eyebrow shows **Act 2**
  - Feed reflects act advancement (if visible)

### 8) Player sees new act

On **Player phone**:

- Tap **Reload** (or wait for auto refresh)
- Expected:
  - Stage eyebrow shows **`PLAYING · Act 2`**

## Act 1 content sanity check (required)

Immediately after **Start Game**, verify on **Player phone**:

- Stage has **non-empty text** (narrative)
- At least **1 objective** is visible
- At least **1 clue OR puzzle** is visible

If any of these are missing, it’s **not playable** even if navigation works.

## If something fails: what to record (fast)

Copy/paste these into your notes:

- **Story**: `<story title>`
- **Host URL**: `<host link>`
- **Player URL**: `<player link>`
- **Step number failed**: `1..8`
- **What you expected** vs **what happened**
- Screenshot of:
  - Host screen (stage + feed)
  - Player screen (stage + cards)

