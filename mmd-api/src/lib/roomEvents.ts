import type { GameState } from '../schemas/index.js'
import type { ServerResponse } from 'http'

type RoomUpdatePayload = {
  type: 'room_update'
  gameId: string
  reason: 'event' | 'state'
  eventId?: string
  eventType?: string
  gameState?: GameState
  currentAct?: number
  timestamp: string
}

type RoomClient = {
  id: number
  raw: ServerResponse
}

const ROOM_CLIENTS = new Map<string, Set<RoomClient>>()
const HEARTBEAT_MS = 25000
let nextClientId = 1
let heartbeatTimer: NodeJS.Timeout | null = null

function logRoomEvent(message: string, meta: Record<string, unknown>) {
  if (process.env.NODE_ENV === 'test' || process.env.SSE_LOGS === 'off') return
  console.info(`[sse] ${message} ${JSON.stringify(meta)}`)
}

function ensureHeartbeat() {
  if (heartbeatTimer || ROOM_CLIENTS.size === 0) return
  heartbeatTimer = setInterval(() => {
    for (const clients of ROOM_CLIENTS.values()) {
      for (const client of clients) {
        if (client.raw.writableEnded || client.raw.destroyed) continue
        client.raw.write(': keepalive\n\n')
      }
    }
  }, HEARTBEAT_MS)
}

function stopHeartbeatIfIdle() {
  if (ROOM_CLIENTS.size > 0 || !heartbeatTimer) return
  clearInterval(heartbeatTimer)
  heartbeatTimer = null
}

function removeRoomClient(gameId: string, clientId: number) {
  const clients = ROOM_CLIENTS.get(gameId)
  if (!clients) return
  for (const client of clients) {
    if (client.id === clientId) {
      clients.delete(client)
      break
    }
  }
  if (clients.size === 0) {
    ROOM_CLIENTS.delete(gameId)
  }
  logRoomEvent('disconnect', {
    gameId,
    clientId,
    roomClients: clients.size,
    activeRooms: ROOM_CLIENTS.size,
  })
  stopHeartbeatIfIdle()
}

export function attachRoomEventStream(gameId: string, raw: ServerResponse) {
  raw.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  })
  raw.write(': connected\n\n')

  const clientId = nextClientId++
  const client: RoomClient = { id: clientId, raw }
  const clients = ROOM_CLIENTS.get(gameId) ?? new Set<RoomClient>()
  clients.add(client)
  ROOM_CLIENTS.set(gameId, clients)
  logRoomEvent('connect', {
    gameId,
    clientId,
    roomClients: clients.size,
    activeRooms: ROOM_CLIENTS.size,
  })
  ensureHeartbeat()

  const cleanup = () => removeRoomClient(gameId, clientId)
  raw.on('close', cleanup)
  raw.on('error', cleanup)

  return cleanup
}

export function publishRoomEvent(input: Omit<RoomUpdatePayload, 'type' | 'reason' | 'timestamp'> & { gameId: string }) {
  publishRoomUpdate({
    type: 'room_update',
    gameId: input.gameId,
    reason: 'event',
    eventId: input.eventId,
    eventType: input.eventType,
    gameState: input.gameState,
    currentAct: input.currentAct,
    timestamp: new Date().toISOString(),
  })
}

export function publishRoomState(input: {
  gameId: string
  gameState: GameState
  currentAct: number
}) {
  publishRoomUpdate({
    type: 'room_update',
    gameId: input.gameId,
    reason: 'state',
    gameState: input.gameState,
    currentAct: input.currentAct,
    timestamp: new Date().toISOString(),
  })
}

function publishRoomUpdate(payload: RoomUpdatePayload) {
  const clients = ROOM_CLIENTS.get(payload.gameId)
  if (!clients?.size) return

  const message = `event: room-update\ndata: ${JSON.stringify(payload)}\n\n`
  for (const client of [...clients]) {
    if (client.raw.writableEnded || client.raw.destroyed) {
      clients.delete(client)
      continue
    }
    client.raw.write(message)
  }

  if (clients.size === 0) {
    ROOM_CLIENTS.delete(payload.gameId)
    stopHeartbeatIfIdle()
  }
}
