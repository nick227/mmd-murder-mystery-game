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
    // Separate contexts = separate storage/cookies (simulates two phones).
    const hostContext = await browser.newContext()
    const playerContext = await browser.newContext()
    const launcherContext = await browser.newContext()

    const launcherPage = await launcherContext.newPage()
    const launcher = await GameHarness.openLauncher(launcherPage)
    const { hostUrl, playerUrls } = await launcher.createGameViaLauncher({ storyTitle })

    const hostPage = await hostContext.newPage()
    const playerPage = await playerContext.newPage()
    const host = await GameHarness.hostFromUrl(hostPage, hostUrl)
    const player = await GameHarness.playerFromUrl(playerPage, playerUrls[0]!)

    await expect(hostPage.getByTestId('stage-eyebrow')).toContainText('SCHEDULED')

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

    await player.ensureJoined()
    await host.sync()
    await expect(hostPage.getByTestId('player-pill-joined-0')).toBeVisible()

    await player.submitObjective()
    await host.sync()
    await expect(hostPage.getByText('Player 0 submitted an objective.')).toBeVisible()

    await player.sync()
    await expect(playerPage.locator('[data-intent="reveal"]')).toBeVisible()

    await host.advanceAct()
    await expect(hostPage.getByTestId('stage-eyebrow')).toContainText('Act 2')
    await expect.poll(async () => host.getAct()).toBe(2)

    await player.sync()
    await expect(playerPage.getByTestId('stage-eyebrow')).toContainText('Act 2')

    await Promise.all([hostContext.close(), playerContext.close(), launcherContext.close()])
  })
}

