# Realtime Feed E2E

## Purpose

This test verifies that lobby feed updates propagate across clients without calling manual sync helpers.

It is intended to validate the SSE room-update path, not the launcher or auth flow.

## Test file

- `mmd-frontend/tests/e2e/feed-realtime.spec.ts`

## Required environment variables

The test expects three prebuilt room URLs:

- `E2E_HOST_URL`
- `E2E_PLAYER_URL`
- `E2E_PLAYER2_URL`

Example:

```env
E2E_HOST_URL=http://localhost:5180/host/game_123?hostKey=host_abc&api=http%3A%2F%2Flocalhost%3A3000
E2E_PLAYER_URL=http://localhost:5180/room/game_123/char_1?api=http%3A%2F%2Flocalhost%3A3000
E2E_PLAYER2_URL=http://localhost:5180/room/game_123/char_2?api=http%3A%2F%2Flocalhost%3A3000
```

## Why URLs are injected

The launcher create-game flow can require sign-in depending on environment.

That setup path is separate from the realtime feed concern. This test starts from known-good room URLs so failures are about propagation, not auth.

## How to get the URLs

Create a game manually in the app, then capture:

1. the host link
2. two player room links for different characters

You can get them from:

- the launcher after creating a game
- host/player invite links already stored in the UI
- an existing playtest room you want to reuse

## How to run the test

PowerShell example:

```powershell
$env:E2E_HOST_URL="http://localhost:5180/host/game_123?hostKey=host_abc&api=http%3A%2F%2Flocalhost%3A3000"
$env:E2E_PLAYER_URL="http://localhost:5180/room/game_123/char_1?api=http%3A%2F%2Flocalhost%3A3000"
$env:E2E_PLAYER2_URL="http://localhost:5180/room/game_123/char_2?api=http%3A%2F%2Flocalhost%3A3000"
npm --prefix C:\wamp64\www\mmd-murder-mystery-game\mmd-frontend run test:e2e -- feed-realtime.spec.ts
```

## Expected behavior

The test checks that:

- player joins appear on host without calling `sync()`
- host game start reaches players without calling `sync()`
- a player post appears on host and a second player without calling `sync()`

## Notes

- If the three env vars are missing, the test skips cleanly.
- The frontend test runner does not automatically read a `.env` file here; set variables in the shell or CI environment.
- This test is best used as targeted verification for the realtime feed path, not as the only multiplayer regression test.
