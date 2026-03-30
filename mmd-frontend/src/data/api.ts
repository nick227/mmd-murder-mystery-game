import type { HostApiGame, PlayerApiView, StoryListItem } from './types'

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

export async function fetchStories(apiBase: string) {
  return request<StoryListItem[]>(`${apiBase}/api/v1/stories`)
}

export async function createGame(apiBase: string, body: {
  storyId: string
  name: string
  scheduledTime: string
  locationText?: string
}) {
  return request<HostApiGame>(`${apiBase}/api/v1/games`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function fetchHostGame(apiBase: string, gameId: string, hostKey: string) {
  return request<HostApiGame>(`${apiBase}/api/v1/games/${gameId}/host`, {
    headers: { 'x-host-key': hostKey },
  })
}

export async function postHostAction(
  apiBase: string,
  gameId: string,
  hostKey: string,
  action: 'start' | 'next-act' | 'done',
) {
  return request<unknown>(`${apiBase}/api/v1/games/${gameId}/host/${action}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-key': hostKey,
    },
    body: '{}',
  })
}

export async function postEndNight(
  apiBase: string,
  gameId: string,
  hostKey: string,
  body: { who: string; how: string; why: string },
) {
  return request<unknown>(`${apiBase}/api/v1/games/${gameId}/host/end-night`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-key': hostKey,
    },
    body: JSON.stringify(body),
  })
}

export async function joinPlayerByCharacter(
  apiBase: string,
  gameId: string,
  characterId: string,
  playerName: string,
) {
  return request<{ message: string }>(`${apiBase}/api/v1/play/${gameId}/character/${characterId}/join`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName }),
  })
}

export async function fetchPlayerViewByCharacter(apiBase: string, gameId: string, characterId: string) {
  return request<PlayerApiView>(`${apiBase}/api/v1/play/${gameId}/character/${characterId}`)
}

export async function submitObjective(
  apiBase: string,
  gameId: string,
  characterId: string,
  objectiveId: string,
) {
  return request<{ message: string }>(`${apiBase}/api/v1/play/${gameId}/character/${characterId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ objectiveId }),
  })
}
