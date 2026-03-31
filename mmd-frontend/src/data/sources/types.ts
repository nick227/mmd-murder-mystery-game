import type { HostApiGame, MoveType, PlayerApiView, StoryListItem } from '../types'
import type { ApiGameSummary } from '../types'

export type HostAction = 'start' | 'next-act' | 'done'

export interface GameSource {
  fetchStories(apiBase: string): Promise<StoryListItem[]>
  fetchGames(apiBase: string): Promise<ApiGameSummary[]>
  createGame(
    apiBase: string,
    body: { storyId: string; name: string; scheduledTime: string; locationText?: string },
  ): Promise<HostApiGame>
  fetchHostGame(apiBase: string, gameId: string, hostKey: string): Promise<HostApiGame>
  cancelGame(apiBase: string, gameId: string, hostKey: string): Promise<ApiGameSummary>
  postHostAction(apiBase: string, gameId: string, hostKey: string, action: HostAction): Promise<unknown>
  postEndNight(apiBase: string, gameId: string, hostKey: string, body: { who: string; how: string; why: string }): Promise<unknown>

  joinPlayerByCharacter(apiBase: string, gameId: string, characterId: string, playerName: string): Promise<{ message: string }>
  submitObjective(apiBase: string, gameId: string, characterId: string, objectiveId: string): Promise<{ message: string }>
  postMove(apiBase: string, gameId: string, body: { characterId: string; moveType: MoveType; text?: string; targetCharacterId?: string }): Promise<{ message: string }>
  fetchPlayerViewByCharacter(apiBase: string, gameId: string, characterId: string): Promise<PlayerApiView>
}

