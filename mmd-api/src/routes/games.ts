import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { toJsonSchema, validate, generateKey, serializeDates } from '../lib/utils.js'
import {
  CreateGameBodySchema,
  RescheduleGameBodySchema,
  UpdateScheduledGameBodySchema,
  GameSchema,
  GameHostViewSchema,
  AssignCharacterBodySchema,
  SubmitCardBodySchema,
  SubmitAnswersBodySchema,
  MysteryAnswerSchema,
  MessageSchema,
  PostMoveBodySchema,
  ErrorSchema,
  GamePublicViewSchema,
} from '../schemas/index.js'
import { loadStoryJson } from '../lib/storyJson.js'
import { adaptGeneratedStoryToRuntime } from '../lib/generatedRuntimeAdapter.js'
import { attachRoomEventStream, publishRoomEvent, publishRoomState } from '../lib/roomEvents.js'
import { revealSolutionsSequentially } from '../lib/revealSecrets.js'

/** No further `/advance` or `/host/next-act` after this; host must POST `/host/end-night`. */
const HOST_RUNTIME_MAX_ACT = 5

async function readStageImageForAct(storyFile: string | null, act: number): Promise<string | null> {
  if (!storyFile) return null
  try {
    const raw = await loadStoryJson(storyFile)
    const runtimeStory = adaptGeneratedStoryToRuntime(raw).runtimeStory
    return runtimeStory.stageByAct?.[act]?.image ?? null
  } catch {
    return null
  }
}

function withCharacterNames(game: any) {
  return {
    ...withCreatorFields(game),
    storyTitle: game.storyTitle ?? game.name,
    players: game.players.map((player: any) => {
      const character = (game._characters ?? []).find((item: any) => item.characterId === player.characterId)
      return {
        ...serializeDates(player),
        characterName: character?.name ?? null,
        portrait: character?.image ?? null,
      }
    }),
  }
}

function withCreatorFields(game: any) {
  return {
    ...serializeDates(game),
    creatorUserId: game.ownerUserId ?? null,
    creatorName: game.creatorName ?? null,
    creatorAvatar: game.creatorAvatar ?? null,
  }
}

export async function gamesRoutes(fastify: FastifyInstance) {

  fastify.get<{ Params: { id: string } }>('/games/:id/public', {
    schema: {
      tags: ['Games'],
      summary: 'Get public game details (no secrets)',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      response: {
        200: toJsonSchema(GamePublicViewSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const game = await prisma.game.findUnique({
      where: { id: req.params.id },
      include: { players: true },
    })
    if (!game) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    }
    if (!game.storyFile) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game has no storyFile' })
    }

    const raw = await loadStoryJson(game.storyFile)
    const { runtimeStory } = adaptGeneratedStoryToRuntime(raw)
    const image = (raw as any)?.storyImage ?? runtimeStory.stageByAct?.[1]?.image ?? null
    const joinedByCharacterId = new Map(game.players.map(p => [p.characterId, Boolean(p.joinedAt)] as const))
    const characters = runtimeStory.playerOrder
      .map(id => runtimeStory.playersByCharacterId[id])
      .filter(Boolean)
      .map(player => ({
        characterId: player.characterId,
        name: player.name,
        archetype: player.archetype,
        portrait: player.image,
        joined: joinedByCharacterId.get(player.characterId) ?? false,
      }))

    return reply.send({
      gameId: game.id,
      gameName: game.name,
      gameState: game.state,
      creatorUserId: game.ownerUserId ?? null,
      creatorName: game.creatorName ?? null,
      creatorAvatar: game.creatorAvatar ?? null,
      scheduledTime: game.scheduledTime.toISOString(),
      locationText: game.locationText,
      story: {
        id: game.storyFile,
        title: runtimeStory.title,
        summary: runtimeStory.summary,
        image,
        characters,
      },
    })
  })

  fastify.post('/games', {
    schema: {
      tags: ['Games'],
      summary: 'Create a new game',
      body: toJsonSchema(CreateGameBodySchema),
      response: {
        201: toJsonSchema(GameHostViewSchema),
        400: toJsonSchema(ErrorSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const body = validate(CreateGameBodySchema, req.body)
    const userId = req.session.userId
    if (!userId) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Sign in required to create a game' })
    }

    const user = await prisma.user.findUnique({ where: { id: userId } })
    if (!user) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Authenticated user not found' })
    }

    const storyFile = body.storyFile ?? body.storyId
    if (!storyFile) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Either storyFile or storyId is required' })
    }
    // Back-compat: older clients send `storyId` with a JSON filename.
    // Only persist DB `storyId` when request explicitly uses `storyFile`.
    const dbStoryId = body.storyFile ? (body.storyId ?? null) : null

    let runtimeStory
    try {
      const raw = await loadStoryJson(storyFile)
      runtimeStory = adaptGeneratedStoryToRuntime(raw).runtimeStory
    } catch {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Story not found' })
    }

    const characters = runtimeStory.playerOrder.map(id => runtimeStory.playersByCharacterId[id]).filter(Boolean)

    const game = await prisma.game.create({
      data: {
        storyFile,
        storyId: dbStoryId,
        name: body.name,
        hostKey: generateKey('host'),
        ownerUserId: user.id,
        creatorName: user.name,
        creatorAvatar: user.avatar || null,
        scheduledTime: new Date(body.scheduledTime),
        locationText: body.locationText ?? null,
        players: {
          create: characters.map((char: any) => ({
            characterId: char.characterId,
            characterName: char.name,
            loginKey: generateKey('char'),
          })),
        },
      },
      include: { players: true },
    })

    return reply.status(201).send(withCharacterNames({ ...game, storyTitle: runtimeStory.title, _characters: characters }))
  })

  fastify.get<{
  Querystring: { limit?: string; offset?: string }
}>('/games', {
    schema: {
      tags: ['Games'],
      summary: 'List all games',
      querystring: {
        type: 'object',
        properties: { 
          limit: { type: 'string', description: 'Maximum number of games to return' },
          offset: { type: 'string', description: 'Number of games to skip' }
        },
      },
      response: {
        200: toJsonSchema(GameSchema.array()),
      },
    },
  }, async (req, reply) => {
    const limit = req.query.limit ? parseInt(req.query.limit) : undefined
    const offset = req.query.offset ? parseInt(req.query.offset) : 0
    
    const games = await prisma.game.findMany({
      orderBy: [
        { state: 'asc' }, // SCHEDULED games first, then PLAYING, etc.
        { scheduledTime: 'desc' }, // Newest scheduled time within each state
        { createdAt: 'desc' }, // Newest creation as tiebreaker
      ],
      skip: offset,
      take: limit,
      select: {
        id: true, storyFile: true, storyId: true, name: true,
        ownerUserId: true, creatorName: true, creatorAvatar: true,
        scheduledTime: true, startedAt: true,
        state: true, currentAct: true,
        locationText: true, createdAt: true, updatedAt: true,
      },
    })
    return reply.send(games.map(withCreatorFields))
  })

  fastify.get<{
    Querystring: { limit?: string; offset?: string }
  }>('/my/games', {
    schema: {
      tags: ['Games'],
      summary: 'Get user-specific games',
      querystring: {
        type: 'object',
        properties: { 
          limit: { type: 'string', description: 'Maximum number of games to return' },
          offset: { type: 'string', description: 'Number of games to skip' }
        },
      },
      response: {
        200: toJsonSchema(GameSchema.array()),
      },
    },
  }, async (req, reply) => {
    const userId = req.session.userId
    if (!userId) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Sign in required' })
    }

    const limit = req.query.limit ? parseInt(req.query.limit) : undefined
    const offset = req.query.offset ? parseInt(req.query.offset) : 0
    
    const games = await prisma.game.findMany({
      where: {
        OR: [
          { ownerUserId: userId },
          { players: { some: { userId: userId } } },
        ],
      },
      orderBy: [
        { state: 'asc' }, // SCHEDULED games first, then PLAYING, etc.
        { scheduledTime: 'desc' }, // Newest scheduled time within each state
        { createdAt: 'desc' }, // Newest creation as tiebreaker
      ],
      skip: offset,
      take: limit,
      include: {
        players: {
          where: { userId: userId },
          select: { characterId: true, characterName: true },
        },
      },
    })
    return reply.send(games.map(g => ({
      ...withCreatorFields(g),
      hostKey: g.ownerUserId === userId ? g.hostKey : undefined,
      joinedCharacters: g.players.map(p => ({ characterId: p.characterId, characterName: p.characterName })),
    })))
  })

  fastify.get<{ Params: { id: string } }>('/games/:id/host', {
    schema: {
      tags: ['Games'],
      summary: 'Get full host view of a game',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      headers: {
        type: 'object',
        properties: { 'x-host-key': { type: 'string', description: 'Host authentication key' } },
        required: ['x-host-key'],
      },
      response: {
        200: toJsonSchema(GameHostViewSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const game = await prisma.game.findUnique({
      where: { id: req.params.id },
      include: { players: true, events: { orderBy: { createdAt: 'asc' } } },
    })
    if (!game) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    }
    const hostKey = req.headers['x-host-key']
    if (hostKey !== game.hostKey) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    }
    if (!game.storyFile) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game has no storyFile' })
    }
    const raw = await loadStoryJson(game.storyFile)
    const runtimeStory = adaptGeneratedStoryToRuntime(raw).runtimeStory
    const characters = runtimeStory.playerOrder.map(id => runtimeStory.playersByCharacterId[id]).filter(Boolean)
    let maxAct = 1
    for (const key of Object.keys(runtimeStory.stageByAct ?? {})) {
      const n = Number(key)
      if (Number.isInteger(n) && n > maxAct) maxAct = n
    }
    for (const card of runtimeStory.cards) {
      if (typeof card.act === 'number' && Number.isFinite(card.act) && card.act > maxAct) maxAct = card.act
    }
    return reply.send(withCharacterNames({
      ...game,
      feed: game.events,
      storyTitle: runtimeStory.title,
      _characters: characters,
      storyId: game.storyFile,
      storyFile: game.storyFile,
      maxAct,
    }))
  })

  fastify.get<{ Params: { id: string }; Querystring: { hostKey?: string } }>('/games/:id/host/stream', {
    schema: {
      tags: ['Games'],
      summary: 'Subscribe to host room updates',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      querystring: {
        type: 'object',
        properties: { hostKey: { type: 'string' } },
        required: ['hostKey'],
      },
      response: {},
    },
  }, async (req, reply) => {
    const game = await prisma.game.findUnique({ where: { id: req.params.id } })
    if (!game) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    }
    if (req.query.hostKey !== game.hostKey) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    }

    reply.hijack()
    attachRoomEventStream(game.id, reply.raw)
    return reply
  })

  fastify.post<{ Params: { id: string } }>('/games/:id/host/reschedule', {
    schema: {
      tags: ['Host Actions'],
      summary: 'Reschedule a game (host)',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      headers: {
        type: 'object',
        properties: { 'x-host-key': { type: 'string' } },
        required: ['x-host-key'],
      },
      body: toJsonSchema(RescheduleGameBodySchema),
      response: {
        200: toJsonSchema(GameSchema),
        400: toJsonSchema(ErrorSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const body = validate(RescheduleGameBodySchema, req.body)
    const game = await prisma.game.findUnique({ where: { id: req.params.id } })
    if (!game) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    if (req.headers['x-host-key'] !== game.hostKey) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    if (game.state !== 'SCHEDULED') return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `Cannot reschedule a game in state ${game.state}` })

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { scheduledTime: new Date(body.scheduledTime) },
    })
    publishRoomState({ gameId: game.id, gameState: updated.state, currentAct: updated.currentAct })
    return reply.send(withCreatorFields(updated))
  })

  fastify.post<{ Params: { id: string } }>('/games/:id/host/update', {
    schema: {
      tags: ['Host Actions'],
      summary: 'Update a scheduled game (host)',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      headers: {
        type: 'object',
        properties: { 'x-host-key': { type: 'string' } },
        required: ['x-host-key'],
      },
      body: toJsonSchema(UpdateScheduledGameBodySchema),
      response: {
        200: toJsonSchema(GameSchema),
        400: toJsonSchema(ErrorSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const body = validate(UpdateScheduledGameBodySchema, req.body)
    const game = await prisma.game.findUnique({ where: { id: req.params.id } })
    if (!game) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    if (req.headers['x-host-key'] !== game.hostKey) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    if (game.state !== 'SCHEDULED') return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `Cannot update a game in state ${game.state}` })

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: {
        name: body.name,
        scheduledTime: new Date(body.scheduledTime),
        locationText: body.locationText,
      },
    })
    publishRoomState({ gameId: game.id, gameState: updated.state, currentAct: updated.currentAct })
    return reply.send(withCreatorFields(updated))
  })

  fastify.post<{ Params: { id: string } }>('/games/:id/host/start', {
    schema: {
      tags: ['Host Actions'],
      summary: 'Start the game early or on time',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      headers: {
        type: 'object',
        properties: { 'x-host-key': { type: 'string' } },
        required: ['x-host-key'],
      },
      response: {
        200: toJsonSchema(GameSchema),
        400: toJsonSchema(ErrorSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const game = await prisma.game.findUnique({ where: { id: req.params.id } })
    if (!game) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    if (req.headers['x-host-key'] !== game.hostKey) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    if (game.state !== 'SCHEDULED') return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `Cannot start a game in state ${game.state}` })

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { state: 'PLAYING', currentAct: 1, startedAt: new Date() },
    })
    const event = await prisma.gameEvent.create({
      data: {
        gameId: game.id,
        playerId: null,
        type: 'START_GAME',
        payload: { act: 1 },
      },
    })
    publishRoomEvent({ gameId: game.id, eventId: event.id, eventType: String(event.type), gameState: updated.state, currentAct: updated.currentAct })
    return reply.send(withCreatorFields(updated))
  })

  // ── API authority endpoints (no local simulation) ──────────────────────────

  fastify.post<{ Params: { id: string } }>('/game/:id/start', {
    schema: {
      tags: ['Game'],
      summary: 'Start the game (host)',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      headers: {
        type: 'object',
        properties: { 'x-host-key': { type: 'string' } },
        required: ['x-host-key'],
      },
      response: {
        200: toJsonSchema(GameSchema),
        400: toJsonSchema(ErrorSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const game = await prisma.game.findUnique({ where: { id: req.params.id } })
    if (!game) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    if (req.headers['x-host-key'] !== game.hostKey) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    if (game.state !== 'SCHEDULED') return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: `Cannot start a game in state ${game.state}` })

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { state: 'PLAYING', currentAct: 1, startedAt: new Date() },
    })
    const stageImage = await readStageImageForAct(game.storyFile, 1)
    const event = await prisma.gameEvent.create({
      data: { gameId: game.id, playerId: null, type: 'START_GAME', payload: { act: 1, stageImage } },
    })
    publishRoomEvent({ gameId: game.id, eventId: event.id, eventType: String(event.type), gameState: updated.state, currentAct: updated.currentAct })
    return reply.send(withCreatorFields(updated))
  })

  fastify.post<{ Params: { id: string } }>('/game/:id/advance', {
    schema: {
      tags: ['Game'],
      summary: 'Advance act (host)',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      headers: {
        type: 'object',
        properties: { 'x-host-key': { type: 'string' } },
        required: ['x-host-key'],
      },
      response: {
        200: toJsonSchema(GameSchema),
        400: toJsonSchema(ErrorSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const game = await prisma.game.findUnique({ where: { id: req.params.id } })
    if (!game) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    if (req.headers['x-host-key'] !== game.hostKey) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    if (game.state !== 'PLAYING') return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Game is not in PLAYING state' })
    if (game.currentAct >= HOST_RUNTIME_MAX_ACT) {
      return reply.send(withCreatorFields(game))
    }

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { currentAct: game.currentAct + 1 },
    })
    const stageImage = await readStageImageForAct(game.storyFile, updated.currentAct)
    const event = await prisma.gameEvent.create({
      data: { gameId: game.id, playerId: null, type: 'ADVANCE_ACT', payload: { act: updated.currentAct, stageImage } },
    })
    publishRoomEvent({ gameId: game.id, eventId: event.id, eventType: String(event.type), gameState: updated.state, currentAct: updated.currentAct })
    return reply.send(withCreatorFields(updated))
  })

  fastify.post<{ Params: { id: string } }>('/game/:id/submit', {
    schema: {
      tags: ['Game'],
      summary: 'Submit a card/objective (player)',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: toJsonSchema(SubmitCardBodySchema),
      response: {
        200: toJsonSchema(MessageSchema),
        400: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const body = validate(SubmitCardBodySchema, req.body)
    const player = await prisma.gamePlayer.findFirst({
      where: { gameId: req.params.id, characterId: body.characterId },
      include: { game: { include: { story: true } } },
    })
    if (!player) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid player' })

    // Server owns act; store both the provided act and currentAct for debugging.
    const runtimeRaw = player.game.storyFile ? await loadStoryJson(player.game.storyFile) : null
    const runtimeStory = runtimeRaw ? adaptGeneratedStoryToRuntime(runtimeRaw).runtimeStory : null
    const index = runtimeStory ? runtimeStory.playerOrder.indexOf(player.characterId) : -1
    const characterName = runtimeStory?.playersByCharacterId?.[player.characterId]?.name ?? null
    const submittedCard = runtimeStory?.cards.find(card => card.id === body.cardId) ?? null

    const event = await prisma.gameEvent.create({
      data: {
        gameId: player.gameId,
        playerId: player.id,
        type: 'SUBMIT_OBJECTIVE',
        payload: {
          cardId: body.cardId,
          cardType: 'objective',
          act: player.game.currentAct,
          providedAct: body.act,
          characterId: player.characterId,
          characterName,
          playerName: player.playerName,
          playerIndex: index >= 0 ? index : null,
          cardTitle: submittedCard?.title ?? null,
          cardText: submittedCard?.text ?? null,
        },
      },
    })
    publishRoomEvent({ gameId: player.gameId, eventId: event.id, eventType: String(event.type), gameState: player.game.state, currentAct: player.game.currentAct })
    return reply.send({ message: 'Submitted' })
  })

  fastify.post<{ Params: { id: string } }>('/game/:id/move', {
    schema: {
      tags: ['Game'],
      summary: 'Post a structured move (player, public)',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      body: toJsonSchema(PostMoveBodySchema),
      response: {
        200: toJsonSchema(MessageSchema),
        400: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const body = validate(PostMoveBodySchema, req.body)
    const player = await prisma.gamePlayer.findFirst({
      where: { gameId: req.params.id, characterId: body.characterId },
      include: { game: true },
    })
    if (!player) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid player' })
    if (player.game.state !== 'SCHEDULED' && player.game.state !== 'PLAYING') {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Game is not accepting room posts in the current state' })
    }

    const runtimeRaw = player.game.storyFile ? await loadStoryJson(player.game.storyFile) : null
    const runtimeStory = runtimeRaw ? adaptGeneratedStoryToRuntime(runtimeRaw).runtimeStory : null
    const character = runtimeStory?.playersByCharacterId?.[player.characterId] ?? null
    const characterName = character?.name ?? body.characterName
    const characterPortrait = character?.image ?? body.characterPortrait ?? null

    const event = await prisma.gameEvent.create({
      data: {
        gameId: player.gameId,
        playerId: player.id,
        type: 'POST_MOVE' as any,
        payload: {
          type: 'POST_MOVE',
          text: body.text,
          clientRequestId: body.clientRequestId,
          characterId: player.characterId,
          characterName,
          characterPortrait,
        },
      },
    })
    publishRoomEvent({ gameId: player.gameId, eventId: event.id, eventType: String(event.type), gameState: player.game.state, currentAct: player.game.currentAct })

    return reply.send({ message: 'Posted' })
  })

  fastify.post<{ Params: { id: string } }>('/games/:id/host/next-act', {
    schema: {
      tags: ['Host Actions'],
      summary: 'Advance to the next act',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      headers: {
        type: 'object',
        properties: { 'x-host-key': { type: 'string' } },
        required: ['x-host-key'],
      },
      response: {
        200: toJsonSchema(GameSchema),
        400: toJsonSchema(ErrorSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const game = await prisma.game.findUnique({ where: { id: req.params.id } })
    if (!game) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    if (req.headers['x-host-key'] !== game.hostKey) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    if (game.state !== 'PLAYING') return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Game is not in PLAYING state' })
    if (game.currentAct >= HOST_RUNTIME_MAX_ACT) {
      return reply.send(withCreatorFields(game))
    }

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { currentAct: game.currentAct + 1 },
    })
    const event = await prisma.gameEvent.create({
      data: {
        gameId: game.id,
        playerId: null,
        type: 'ADVANCE_ACT',
        payload: { act: updated.currentAct },
      },
    })
    publishRoomEvent({ gameId: game.id, eventId: event.id, eventType: String(event.type), gameState: updated.state, currentAct: updated.currentAct })
    return reply.send(withCreatorFields(updated))
  })

  fastify.post<{ Params: { id: string } }>('/games/:id/host/end-night', {
    schema: {
      tags: ['Host Actions'],
      summary: 'End the night and submit mystery answers',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      headers: {
        type: 'object',
        properties: { 'x-host-key': { type: 'string' } },
        required: ['x-host-key'],
      },
      body: toJsonSchema(SubmitAnswersBodySchema),
      response: {
        200: toJsonSchema(MysteryAnswerSchema.array()),
        400: toJsonSchema(ErrorSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const game = await prisma.game.findUnique({ where: { id: req.params.id } })
    if (!game) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    if (req.headers['x-host-key'] !== game.hostKey) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    if (game.state !== 'PLAYING') return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Game is not in PLAYING state' })

    const body = validate(SubmitAnswersBodySchema, req.body)
    const tracks = ['who', 'how', 'why'] as const
    const answers = await Promise.all(
      tracks.map(track =>
        prisma.gameMysteryAnswer.upsert({
          where: { gameId_track: { gameId: game.id, track } },
          create: { gameId: game.id, track, answer: body[track] },
          update: { answer: body[track] },
        })
      )
    )

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { state: 'REVEAL' },
    })

    await revealSolutionsSequentially({
      game,
      state: updated,
      storyFile: game.storyFile,
    })

    publishRoomState({ gameId: game.id, gameState: updated.state, currentAct: updated.currentAct })

    return reply.send(serializeDates(answers))
  })

  fastify.post<{ Params: { id: string } }>('/games/:id/host/done', {
    schema: {
      tags: ['Host Actions'],
      summary: 'Mark game as done',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      headers: {
        type: 'object',
        properties: { 'x-host-key': { type: 'string' } },
        required: ['x-host-key'],
      },
      response: {
        200: toJsonSchema(GameSchema),
        400: toJsonSchema(ErrorSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const game = await prisma.game.findUnique({ where: { id: req.params.id } })
    if (!game) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    if (req.headers['x-host-key'] !== game.hostKey) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    if (game.state !== 'REVEAL') return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Game must be in REVEAL state to mark as done' })

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { state: 'DONE' },
    })
    publishRoomState({ gameId: game.id, gameState: updated.state, currentAct: updated.currentAct })
    return reply.send(withCreatorFields(updated))
  })

  fastify.post<{ Params: { id: string } }>('/games/:id/host/cancel', {
    schema: {
      tags: ['Host Actions'],
      summary: 'Cancel a game (soft-cancel, preserves history)',
      params: {
        type: 'object',
        properties: { id: { type: 'string' } },
        required: ['id'],
      },
      headers: {
        type: 'object',
        properties: { 'x-host-key': { type: 'string' } },
        required: ['x-host-key'],
      },
      response: {
        200: toJsonSchema(GameSchema),
        400: toJsonSchema(ErrorSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const game = await prisma.game.findUnique({ where: { id: req.params.id } })
    if (!game) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    if (req.headers['x-host-key'] !== game.hostKey) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    if (game.state === 'DONE') return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Cannot cancel a DONE game' })

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { state: 'CANCELLED' },
    })
    publishRoomState({ gameId: game.id, gameState: updated.state, currentAct: updated.currentAct })
    return reply.send(withCreatorFields(updated))
  })

  fastify.post<{ Params: { id: string; playerId: string } }>('/games/:id/players/:playerId/assign', {
    schema: {
      tags: ['Host Actions'],
      summary: 'Assign a character to a player slot',
      params: {
        type: 'object',
        properties: { id: { type: 'string' }, playerId: { type: 'string' } },
        required: ['id', 'playerId'],
      },
      headers: {
        type: 'object',
        properties: { 'x-host-key': { type: 'string' } },
        required: ['x-host-key'],
      },
      body: toJsonSchema(AssignCharacterBodySchema),
      response: {
        200: toJsonSchema(MessageSchema),
        401: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const game = await prisma.game.findUnique({ where: { id: req.params.id } })
    if (!game) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    if (req.headers['x-host-key'] !== game.hostKey) return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })

    const body = validate(AssignCharacterBodySchema, req.body)
    const player = await prisma.gamePlayer.findFirst({
      where: { id: req.params.playerId, gameId: game.id },
    })
    if (!player) return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Player slot not found' })

    await prisma.gamePlayer.update({
      where: { id: player.id },
      data: { characterId: body.characterId },
    })

    return reply.send({ message: `Character ${body.characterId} assigned to player slot ${player.id}` })
  })
}
