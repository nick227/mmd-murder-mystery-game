import { expect, test } from '@playwright/test'
import { GameHarness } from './gameHarness'


async function storyTitlesToTest(): Promise<string[]> {
  const env = process.env.E2E_STORIES?.trim()
  if (env) return env.split('|').map(s => s.trim()).filter(Boolean)
  // Default: gate every story exposed by the API (playability burn-down driver).
  const res = await fetch('http://localhost:5180/api/v1/stories')
  if (!res.ok) throw new Error(`Failed to load stories for E2E: ${res.status}`)
  const stories = (await res.json()) as Array<{ title?: unknown }>
  return stories
    .map(s => (typeof s.title === 'string' ? s.title : null))
    .filter((t): t is string => Boolean(t))
}

for (const storyTitle of await storyTitlesToTest()) {
  test(`canonical completeness: real multiplayer (API) loop — ${storyTitle}`, async ({ browser }) => {
    test.setTimeout(120_000)
    // Separate contexts = separate storage/cookies (simulates two phones).
    const hostContext = await browser.newContext()
    const playerContext = await browser.newContext()
    const player2Context = await browser.newContext()
    const launcherContext = await browser.newContext()

    const customHostUrl = process.env.E2E_HOST_URL?.trim()
    const customPlayerUrl = process.env.E2E_PLAYER_URL?.trim()
    const customPlayer2Url = process.env.E2E_PLAYER2_URL?.trim()

    let hostUrl: string
    let playerUrl: string
    let player2Url: string | null = null
    if (customHostUrl && customPlayerUrl) {
      hostUrl = customHostUrl
      playerUrl = customPlayerUrl
      player2Url = customPlayer2Url || null
    } else {
      const launcherPage = await launcherContext.newPage()
      const launcher = await GameHarness.openLauncher(launcherPage)
      const created = await launcher.createGameViaLauncher({ storyTitle })
      hostUrl = created.hostUrl
      playerUrl = created.playerUrls[0]!
      player2Url = created.playerUrls[1] ?? null
    }

    const hostPage = await hostContext.newPage()
    const playerPage = await playerContext.newPage()
    const player2Page = await player2Context.newPage()
    const host = await GameHarness.hostFromUrl(hostPage, hostUrl)
    const player = await GameHarness.playerFromUrl(playerPage, playerUrl)
    const player2 = player2Url ? await GameHarness.playerFromUrl(player2Page, player2Url) : null

    await expect(hostPage.getByTestId('stage-eyebrow')).toContainText('SCHEDULED')

    // 1) Pregame waiting state: player joins before host starts, sees waiting for host.
    await player.ensureJoined('Player 0')
    await player.sync()
    await playerPage.getByRole('button', { name: 'Lobby' }).click()
    await expect(playerPage.getByText('Waiting for the host')).toBeVisible()

    // 3) Multi-player join (minimum 2)
    if (player2) {
      await player2.ensureJoined('Player 1')
      await host.sync()
      await expect(hostPage.getByText('Player 0 joined')).toBeVisible()
      await expect(hostPage.getByText('Player 1 joined')).toBeVisible()
    }

    // 2) Refresh resilience: player refresh retains joined state.
    await playerPage.reload()
    await playerPage.getByRole('button', { name: 'Lobby' }).click()
    await playerPage.getByTestId('bottom-nav-game').click()
    await expect(playerPage.getByTestId('stage-eyebrow')).toBeVisible()
    await expect(playerPage.getByTestId('join-name')).toHaveCount(0)

    await host.startGame()
    try {
      await expect.poll(async () => {
        await host.sync()
        return host.getGameState()
      }).toBe('PLAYING')
    } catch (err) {
      const status = (await hostPage.locator('.status-dot').innerText()).trim()
      throw new Error(`Host did not enter PLAYING. Status="${status}". ${(err as Error).message}`)
    }

    // Validate START_GAME is visible to host via feed (event log).
    await expect(hostPage.getByText('Game started')).toBeVisible()

    // Validate start propagates to player via server state.
    await player.sync()
    await playerPage.getByTestId('bottom-nav-game').click()
    await expect(playerPage.getByTestId('stage-eyebrow')).toContainText('PLAYING')
    await expect(playerPage.getByTestId('stage-eyebrow')).toContainText('Act 1')

    await host.sync()

    // Act 1 content visibility (not optional)
    await player.sync()
    await playerPage.getByTestId('bottom-nav-game').click()
    await expect(playerPage.locator('.stage__description')).not.toHaveText('')
    await playerPage.getByTestId('bottom-nav-game').click()
    await expect.poll(async () => playerPage.locator('[data-testid^="objective-toggle:"]').count()).toBeGreaterThan(0)
    // Must have at least 1 clue OR puzzle visible.
    const hasPuzzle = (await playerPage.locator('[data-intent=\"puzzle\"]').count()) > 0
    const hasClue = (await playerPage.locator('.list-row__title').filter({ hasText: 'Clue' }).count()) > 0
    expect(hasPuzzle || hasClue).toBeTruthy()

    // Minimal structured post: player posts to feed, host sees it (composer on Lobby tab).
    await playerPage.getByRole('button', { name: 'Lobby' }).click()
    await playerPage.getByTestId('composer-panel').locator('textarea').fill('study')
    await playerPage.getByTestId('composer-panel').getByRole('button', { name: 'Post' }).click()
    await host.sync()
    await expect(hostPage.getByText('study')).toBeVisible()

    await player.submitObjective()
    await host.sync()
    await expect(hostPage.getByTestId('feed-item').filter({ hasText: 'completed:' }).first()).toBeVisible()

    await player.sync()
    await playerPage.getByTestId('bottom-nav-game').click()
    await expect(playerPage.locator('[data-testid="evidence-item"][data-kind="reveal"]').first()).toBeVisible()

    await host.advanceAct()
    await expect(hostPage.getByTestId('stage-eyebrow')).toContainText('Act 2')
    await expect.poll(async () => host.getAct()).toBe(2)

    await player.sync()
    await playerPage.getByTestId('bottom-nav-game').click()
    await expect(playerPage.getByTestId('stage-eyebrow')).toContainText('Act 2')

    // 4) Multi-act progression (>2): advance to Act 3 and verify player sees it.
    await host.advanceAct()
    await expect(hostPage.getByTestId('stage-eyebrow')).toContainText('Act 3')
    await expect.poll(async () => host.getAct()).toBe(3)

    await player.sync()
    await playerPage.getByTestId('bottom-nav-game').click()
    await expect(playerPage.getByTestId('stage-eyebrow')).toContainText('Act 3')

    // Refresh resilience after start: player refresh retains Act 1+ state (at least stays PLAYING).
    await playerPage.reload()
    await playerPage.getByTestId('bottom-nav-game').click()
    await expect(playerPage.getByTestId('stage-eyebrow')).toContainText('PLAYING')

    await Promise.all([hostContext.close(), playerContext.close(), player2Context.close(), launcherContext.close()])
  })
}
