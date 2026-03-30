import type { Page } from '@playwright/test'

export type GameState = 'SCHEDULED' | 'PLAYING' | 'REVEAL' | 'DONE'

function parseStageEyebrow(text: string): { state: GameState; act: number } {
  const trimmed = text.trim()
  const match = /^(SCHEDULED|PLAYING|REVEAL|DONE)\s+·\s+act\s+(\d+)$/i.exec(trimmed)
  if (!match) throw new Error(`Unexpected stage eyebrow: "${trimmed}"`)
  return { state: match[1].toUpperCase() as GameState, act: Number(match[2]) }
}

export class GameHarness {
  constructor(private readonly page: Page) {}

  static async openLauncher(page: Page, opts?: { apiBase?: string }) {
    const query = new URLSearchParams()
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
    await this.page.getByText('Playtest launcher').waitFor()
    if (opts?.storyTitle) {
      // Story option renders <strong>{story.title}</strong>
      const chosen = this.page.locator('.story-option', { hasText: opts.storyTitle }).first()
      await chosen.waitFor()
      await chosen.click()
    } else {
      const firstStory = this.page.locator('.story-option').first()
      await firstStory.waitFor()
      await firstStory.click()
    }

    await this.page.getByText('Create game').click()

    await this.page.locator('.created-box').waitFor()
    const hostUrl = (await this.page.locator('.created-box code').first().innerText()).trim()
    const playerUrls = (await this.page.locator('.created-box .link-row code').allInnerTexts()).map(t => t.trim())
    if (!hostUrl) throw new Error('Missing hostUrl from launcher')
    if (!playerUrls.length) throw new Error('Missing playerUrls from launcher')
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
    // MVP: completing the first objective represents "submit card".
    // We keep this as an intent so selectors can evolve independently.
    const firstToggle = this.page.locator('[data-testid^="objective-toggle:"]').first()
    await firstToggle.click()
  }

  async ensureJoined(playerName = 'Playwright Player') {
    // If the join UI is present, join; otherwise assume already joined.
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
    const eyebrow = await this.page.getByTestId('stage-eyebrow').innerText()
    return parseStageEyebrow(eyebrow)
  }
}

