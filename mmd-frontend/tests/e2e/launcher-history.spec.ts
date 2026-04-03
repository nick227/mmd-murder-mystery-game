import { expect, test, type Page } from '@playwright/test'

const APP_ORIGIN = process.env.E2E_APP_ORIGIN?.trim() || 'http://localhost:5180'

async function devLogin(page: Page) {
  const res = await page.request.post(`${APP_ORIGIN}/api/v1/auth/dev-login`)
  expect(res.ok()).toBeTruthy()
}

async function createGameViaApi(page: Page, opts: { name: string }) {
  await devLogin(page)

  const storiesRes = await page.request.get(`${APP_ORIGIN}/api/v1/stories`)
  expect(storiesRes.ok()).toBeTruthy()
  const stories = (await storiesRes.json()) as Array<{ id?: unknown }>
  const storyId = stories.find(s => typeof s.id === 'string')?.id as string | undefined
  expect(typeof storyId).toBe('string')

  const scheduledTime = new Date(Date.now() + 60_000).toISOString()
  const createRes = await page.request.post(`${APP_ORIGIN}/api/v1/games`, {
    data: { storyId, name: opts.name, scheduledTime, locationText: 'E2E' },
  })
  expect(createRes.ok()).toBeTruthy()
  const game = (await createRes.json()) as {
    id: string
    hostKey: string
    players: Array<{ characterId: string }>
  }
  expect(typeof game.id).toBe('string')
  expect(typeof game.hostKey).toBe('string')
  expect(Array.isArray(game.players) && game.players.length > 0).toBeTruthy()
  expect(typeof game.players[0]?.characterId).toBe('string')

  return { id: game.id, hostKey: game.hostKey, characterId: game.players[0]!.characterId }
}

test('launcher history item opens details with Join + actions (apiBase="")', async ({ page }) => {
  const created = await createGameViaApi(page, { name: 'History E2E' })
  const storiesRes = await page.request.get(`${APP_ORIGIN}/api/v1/stories`)
  expect(storiesRes.ok()).toBeTruthy()
  const stories = (await storiesRes.json()) as Array<{ id?: unknown; title?: unknown; summary?: unknown; image?: unknown }>
  const createdStory = stories.find(s => typeof s.id === 'string') ?? null

  // Seed localStorage before the app boots so the launcher can read it.
  await page.addInitScript(({ createdGame }) => {
    const key = 'mmd:links:v1'
    const now = new Date().toISOString()
    const value = [
      {
        gameId: createdGame.id,
        apiBase: '', // same-origin API base (critical regression case)
        hostKey: createdGame.hostKey,
        characterIds: [], // critical: no stored characterIds; must fetch public details
        story: undefined, // critical: no stored story snapshot; must fetch public details
        lastSeenAt: now,
      },
    ]
    window.localStorage.setItem(key, JSON.stringify(value))
  }, { createdGame: created })

  await page.goto('/')

  // Click the history row that has saved access (host link is present).
  const rowWithAccess = page.locator('.link-row', {
    has: page.getByRole('button', { name: 'Open host' }),
  }).filter({ hasText: 'History E2E' }).first()
  await rowWithAccess.getByRole('button', { name: 'History E2E' }).click()

  // Sheet should include a rejoin CTA + host actions (from stored hostKey).
  await expect(page.getByTestId('bottom-sheet')).toBeVisible()
  // Join game (single-button) may not appear without stored characterIds; rejoin list should.
  await expect(page.getByRole('button', { name: 'Cancel game' })).toBeVisible()
  // Public details fetch should populate story card + rejoin list.
  await expect(page.getByTestId('bottom-sheet').locator('.story-option__image')).toHaveCount(1)
  await expect(page.getByTestId('bottom-sheet').getByText('Rejoin as')).toBeVisible()
  // At least one character row should render.
  await expect.poll(async () => page.getByTestId('bottom-sheet').locator('.story-option--row').count()).toBeGreaterThan(0)
})
