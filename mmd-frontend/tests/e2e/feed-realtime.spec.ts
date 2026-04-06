import { expect, test } from '@playwright/test'
import { GameHarness } from './gameHarness'

test('feed propagates across clients without manual sync', async ({ browser }) => {
  test.setTimeout(120_000)

  const customHostUrl = process.env.E2E_HOST_URL?.trim()
  const customPlayerUrl = process.env.E2E_PLAYER_URL?.trim()
  const customPlayer2Url = process.env.E2E_PLAYER2_URL?.trim()
  test.skip(
    !customHostUrl || !customPlayerUrl || !customPlayer2Url,
    'Provide E2E_HOST_URL, E2E_PLAYER_URL, and E2E_PLAYER2_URL to run realtime propagation coverage.',
  )
  const player1Context = await browser.newContext()
  const player2Context = await browser.newContext()
  const hostContext = await browser.newContext()
  const created = {
    hostUrl: customHostUrl!,
    playerUrls: [customPlayerUrl!, customPlayer2Url!],
  }

  const hostPage = await hostContext.newPage()
  const player1Page = await player1Context.newPage()
  const player2Page = await player2Context.newPage()
  const host = await GameHarness.hostFromUrl(hostPage, created.hostUrl)
  const player1 = await GameHarness.playerFromUrl(player1Page, created.playerUrls[0]!)
  const player2 = await GameHarness.playerFromUrl(player2Page, created.playerUrls[1]!)

  await player1.ensureJoined('Realtime Player 1')
  await player2.ensureJoined('Realtime Player 2')

  await expect(hostPage.getByText('Realtime Player 1 joined')).toBeVisible({ timeout: 15_000 })
  await expect(hostPage.getByText('Realtime Player 2 joined')).toBeVisible({ timeout: 15_000 })

  await host.startGame()

  await expect(player1Page.getByTestId('stage-eyebrow')).toContainText('PLAYING', { timeout: 15_000 })
  await expect(player2Page.getByTestId('stage-eyebrow')).toContainText('PLAYING', { timeout: 15_000 })

  await player1Page.getByRole('button', { name: 'Feed' }).click()
  await player1Page.getByTestId('composer-panel').locator('textarea').fill('realtime post check')
  await player1Page.getByTestId('composer-panel').getByRole('button', { name: 'Post' }).click()

  await expect(hostPage.getByText('realtime post check')).toBeVisible({ timeout: 15_000 })
  await expect(player2Page.getByText('realtime post check')).toBeVisible({ timeout: 15_000 })

  await Promise.all([
    player1Context.close(),
    player2Context.close(),
    hostContext.close(),
  ])
})
