import type { ApiGameSummary, ApiPublicGameView, HostApiGame, PlayerApiView, PostMovePayload, StoryListItem } from './types'

type StreamStatus = 'connected' | 'disconnected'

function buildApiUrl(apiBase: string, path: string) {
  return `${apiBase}${path}`
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    const text = await response.text()
    throw new Error(text || `Request failed: ${response.status}`)
  }
  return response.json() as Promise<T>
}

function subscribeToRoomStream(input: {
  url: string
  onUpdate: () => void
  onStatusChange?: (status: StreamStatus) => void
}) {
  const stream = new EventSource(input.url)
  stream.addEventListener('room-update', () => {
    input.onUpdate()
  })
  stream.onopen = () => input.onStatusChange?.('connected')
  stream.onerror = () => input.onStatusChange?.('disconnected')

  return () => {
    stream.close()
    input.onStatusChange?.('disconnected')
  }
}

export async function fetchStories(apiBase: string) {
  return request<StoryListItem[]>(buildApiUrl(apiBase, '/api/v1/stories'))
}

export async function createGame(apiBase: string, body: {
  storyId: string
  name: string
  scheduledTime: string
  locationText?: string
}) {
  return request<HostApiGame>(buildApiUrl(apiBase, '/api/v1/games'), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export async function fetchGames(apiBase: string, options?: { limit?: number; offset?: number }) {
  const params = new URLSearchParams()
  if (options?.limit) params.append('limit', options.limit.toString())
  if (options?.offset) params.append('offset', options.offset.toString())
  const query = params.toString()
  return request<ApiGameSummary[]>(buildApiUrl(apiBase, `/api/v1/games${query ? `?${query}` : ''}`))
}

export async function fetchPublicGame(apiBase: string, gameId: string) {
  return request<ApiPublicGameView>(buildApiUrl(apiBase, `/api/v1/games/${gameId}/public`))
}

export async function fetchHostGame(apiBase: string, gameId: string, hostKey: string) {
  return request<HostApiGame>(buildApiUrl(apiBase, `/api/v1/games/${gameId}/host`), {
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
    return request<unknown>(buildApiUrl(apiBase, `/api/v1/game/${gameId}/start`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-host-key': hostKey },
      body: '{}',
    })
  }
  if (action === 'next-act') {
    return request<unknown>(buildApiUrl(apiBase, `/api/v1/game/${gameId}/advance`), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-host-key': hostKey },
      body: '{}',
    })
  }
  // 'done' remains on the legacy endpoint until End Night is migrated.
  return request<unknown>(buildApiUrl(apiBase, `/api/v1/games/${gameId}/host/${action}`), {
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
  return request<unknown>(buildApiUrl(apiBase, `/api/v1/games/${gameId}/host/end-night`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-key': hostKey,
    },
    body: JSON.stringify(body),
  })
}

export async function cancelGame(apiBase: string, gameId: string, hostKey: string) {
  return request<ApiGameSummary>(buildApiUrl(apiBase, `/api/v1/games/${gameId}/host/cancel`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-key': hostKey,
    },
    body: '{}',
  })
}

export async function rescheduleGame(apiBase: string, gameId: string, hostKey: string, scheduledTime: string) {
  return request<ApiGameSummary>(buildApiUrl(apiBase, `/api/v1/games/${gameId}/host/reschedule`), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-host-key': hostKey,
    },
    body: JSON.stringify({ scheduledTime }),
  })
}

export async function updateScheduledGame(
  apiBase: string,
  gameId: string,
  hostKey: string,
  body: { name: string; scheduledTime: string; locationText: string },
) {
  return request<ApiGameSummary>(buildApiUrl(apiBase, `/api/v1/games/${gameId}/host/update`), {
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
  return request<{ message: string }>(buildApiUrl(apiBase, `/api/v1/play/${gameId}/character/${characterId}/join`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ playerName }),
  })
}

export async function fetchPlayerViewByCharacter(apiBase: string, gameId: string, characterId: string) {
  return request<PlayerApiView>(buildApiUrl(apiBase, `/api/v1/play/${gameId}/character/${characterId}`))
}

export async function submitObjective(
  apiBase: string,
  gameId: string,
  characterId: string,
  objectiveId: string,
) {
  // API authority submit endpoint (cardId = objectiveId)
  return request<{ message: string }>(buildApiUrl(apiBase, `/api/v1/game/${gameId}/submit`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ characterId, cardId: objectiveId, act: 0 }),
  })
}

export async function postMove(
  apiBase: string,
  gameId: string,
  body: PostMovePayload,
) {
  return request<{ message: string }>(buildApiUrl(apiBase, `/api/v1/game/${gameId}/move`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
}

export function subscribePlayerRoomStream(
  apiBase: string,
  gameId: string,
  characterId: string,
  onUpdate: () => void,
  onStatusChange?: (status: StreamStatus) => void,
) {
  return subscribeToRoomStream({
    url: buildApiUrl(apiBase, `/api/v1/play/${gameId}/character/${characterId}/stream`),
    onUpdate,
    onStatusChange,
  })
}

export function subscribeHostRoomStream(
  apiBase: string,
  gameId: string,
  hostKey: string,
  onUpdate: () => void,
  onStatusChange?: (status: StreamStatus) => void,
) {
  const query = new URLSearchParams({ hostKey })
  return subscribeToRoomStream({
    url: buildApiUrl(apiBase, `/api/v1/games/${gameId}/host/stream?${query.toString()}`),
    onUpdate,
    onStatusChange,
  })
}
