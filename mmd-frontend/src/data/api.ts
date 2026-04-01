import type { ApiGameSummary, HostApiGame, PlayerApiView, PostKind, StoryListItem } from './types'

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

export async function fetchGames(apiBase: string) {
  return request<ApiGameSummary[]>(`${apiBase}/api/v1/games`)
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
  if (action === 'start') {
    return request<unknown>(`${apiBase}/api/v1/game/${gameId}/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-host-key': hostKey },
      body: '{}',
    })
  }
  if (action === 'next-act') {
    return request<unknown>(`${apiBase}/api/v1/game/${gameId}/advance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-host-key': hostKey },
      body: '{}',
    })
  }
  // 'done' remains on the legacy endpoint until End Night is migrated.
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

export async function cancelGame(apiBase: string, gameId: string, hostKey: string) {
  return request<ApiGameSummary>(`${apiBase}/api/v1/games/${gameId}/host/cancel`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-key': hostKey,
    },
    body: '{}',
  })
}

export async function rescheduleGame(apiBase: string, gameId: string, hostKey: string, scheduledTime: string) {
  return request<ApiGameSummary>(`${apiBase}/api/v1/games/${gameId}/host/reschedule`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-key': hostKey,
    },
    body: JSON.stringify({ scheduledTime }),
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
  // API authority submit endpoint (cardId = objectiveId)
  return request<{ message: string }>(`${apiBase}/api/v1/game/${gameId}/submit`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, cardId: objectiveId, act: 0 }),
  })
}

/** Player post to the room feed. Server route is still `/move`; JSON field remains `moveType`. */
export async function postToFeed(
  apiBase: string,
  gameId: string,
  body: { characterId: string; postKind: PostKind; text?: string; targetCharacterId?: string },
) {
  return request<{ message: string }>(`${apiBase}/api/v1/game/${gameId}/move`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      characterId: body.characterId,
      moveType: body.postKind,
      text: body.text,
      targetCharacterId: body.targetCharacterId,
    }),
  })
}
