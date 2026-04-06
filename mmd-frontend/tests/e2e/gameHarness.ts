import { expect, type Page } from '@playwright/test'

export type GameState = 'SCHEDULED' | 'PLAYING' | 'REVEAL' | 'DONE' | 'CANCELLED'

const API_BASE = process.env.E2E_API_URL?.trim() || 'http://localhost:3000'

function parseStageEyebrow(text: string): { state: GameState; act: number } {
  const trimmed = text.replace(/\s+/g, ' ').trim()
  const match = /^(SCHEDULED|PLAYING|REVEAL|DONE|CANCELLED)\s*(?:·|Â·)\s*act\s*(\d+)$/i.exec(trimmed)
  if (!match) throw new Error(`Unexpected stage eyebrow: "${trimmed}"`)
  return { state: match[1].toUpperCase() as GameState, act: Number(match[2]) }
}

export class GameHarness {
  constructor(private readonly page: Page) {}

  static async openLauncher(page: Page, opts?: { apiBase?: string }) {
    const query = new URLSearchParams()
    query.set('e2e', '1')
    if (opts?.apiBase) query.set('api', opts.apiBase)
    const suffix = query.toString()
    await page.goto(suffix ? `/?${suffix}` : '/')
    return new GameHarness(page)
  }

  static async hostFromUrl(page: Page, url: string) {
    await page.goto(url)
    return new GameHarness(page)
  }

  static async playerFromUrl(page: Page, url: string) {
    await page.goto(url)
    return new GameHarness(page)
  }

  async createGameViaLauncher(opts?: { storyTitle?: string }): Promise<{ hostUrl: string; playerUrls: string[] }> {
    await this.page.getByRole('heading', { name: 'Stories' }).waitFor({ timeout: 60_000 })

    if (opts?.storyTitle) {
      const create = this.page
        .locator('.story-option')
        .filter({ hasText: opts.storyTitle })
        .getByRole('button', { name: 'Create game' })
      await expect(create).toBeEnabled({ timeout: 60_000 })
      await create.click()
    } else {
      const create = this.page.locator('.story-option').first().getByRole('button', { name: 'Create game' })
      await expect(create).toBeEnabled({ timeout: 60_000 })
      await create.click()
    }

    const sheet = this.page.getByTestId('bottom-sheet')
    await sheet.waitFor({ state: 'visible', timeout: 60_000 })
    await sheet.getByText('New game').waitFor({ state: 'visible', timeout: 60_000 })

    await sheet.locator('.field').filter({ hasText: 'Game title' }).locator('input').fill(`E2E ${Date.now()}`)
    await sheet.locator('.field').filter({ hasText: 'Location' }).locator('input').fill('The library')

    await sheet.locator('.story-option--row').first().click()

    await sheet.getByRole('button', { name: 'Create game' }).click()

    await this.page.waitForURL(/\/room\/[^/]+\/[^/]+(\?|$)/, { timeout: 60_000 })

    const pageUrl = new URL(this.page.url())
    const pathParts = pageUrl.pathname.split('/').filter(Boolean)
    const gameId = pathParts[1]
    const hostKey = pageUrl.searchParams.get('hostKey') ?? ''
    const api = pageUrl.searchParams.get('api') ?? ''

    if (!gameId || !hostKey) throw new Error('Expected room URL with game id and hostKey after create')

    const origin = pageUrl.origin
    const apiQuery = api ? `&api=${encodeURIComponent(api)}` : ''
    const hostUrl = `${origin}/host/${gameId}?hostKey=${encodeURIComponent(hostKey)}${apiQuery}`

    const publicRes = await fetch(`${API_BASE}/api/v1/games/${gameId}/public`)
    if (!publicRes.ok) throw new Error(`GET public game failed: ${publicRes.status}`)
    const pub = (await publicRes.json()) as { story: { characters: Array<{ characterId: string }> } }
    const ids = pub.story.characters.map(c => c.characterId)
    const apiPrefix = api ? `?api=${encodeURIComponent(api)}` : ''
    const playerUrls = ids.map(characterId => `${origin}/room/${gameId}/${characterId}${apiPrefix}`)

    return { hostUrl, playerUrls }
  }

  async startGame() {
    await this.page.getByTestId('action:start').click()
  }

  async sync() {
    const reload = this.page.getByTestId('reload')
    if (await reload.count()) {
      await reload.click()
    }
  }

  async advanceAct() {
    await this.page.getByTestId('action:next').click()
  }

  async submitObjective() {
    await this.ensureJoined()
    const firstToggle = this.page.locator('[data-testid^="objective-toggle:"]').first()
    await firstToggle.click()
  }

  async ensureJoined(playerName = 'Playwright Player') {
    const joinInput = this.page.getByTestId('join-name')
    if (await joinInput.count()) {
      await joinInput.fill(playerName)
      await this.page.getByTestId('join-submit').click()
      await this.page.getByTestId('stage-eyebrow').waitFor()
    }
  }

  async getGameState(): Promise<GameState> {
    const { state } = await this.getStage()
    return state
  }

  async getAct(): Promise<number> {
    const { act } = await this.getStage()
    return act
  }

  private async getStage() {
    const actEyebrow = this.page.getByTestId('stage-act-eyebrow')
    const storyEyebrow = this.page.getByTestId('stage-eyebrow')
    const loc = (await actEyebrow.count()) > 0 ? actEyebrow : storyEyebrow
    const eyebrow = await loc.first().innerText()
    return parseStageEyebrow(eyebrow)
  }
}
