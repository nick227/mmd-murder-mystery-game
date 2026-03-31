import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { toJsonSchema, validate, generateKey, serializeDates } from '../lib/utils.js'
import {
  CreateGameBodySchema,
  GameSchema,
  GameHostViewSchema,
  AssignCharacterBodySchema,
  SubmitCardBodySchema,
  SubmitAnswersBodySchema,
  MysteryAnswerSchema,
  MessageSchema,
  PostMoveBodySchema,
  ErrorSchema,
} from '../schemas/index.js'
import { loadStoryJson } from '../lib/storyJson.js'
import { adaptGeneratedStoryToRuntime } from '../lib/generatedRuntimeAdapter.js'

function withCharacterNames(game: any) {
  return {
    ...serializeDates(game),
    storyTitle: game.storyTitle ?? game.name,
    players: game.players.map((player: any) => {
      const character = (game._characters ?? []).find((item: any) => item.characterId === player.characterId)
      return {
        ...serializeDates(player),
        characterName: character?.name ?? null,
      }
    }),
  }
}

export async function gamesRoutes(fastify: FastifyInstance) {

  fastify.post('/games', {
    schema: {
      tags: ['Games'],
      summary: 'Create a new game',
      body: toJsonSchema(CreateGameBodySchema),
      response: {
        201: toJsonSchema(GameHostViewSchema),
        400: toJsonSchema(ErrorSchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const body = validate(CreateGameBodySchema, req.body)

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
        scheduledTime: new Date(body.scheduledTime),
        locationText: body.locationText ?? null,
        players: {
          create: characters.map((char: any) => ({
            characterId: char.characterId,
            loginKey: generateKey('char'),
          })),
        },
      },
      include: { players: true },
    })

    return reply.status(201).send(withCharacterNames({ ...game, storyTitle: runtimeStory.title, _characters: characters }))
  })

  fastify.get('/games', {
    schema: {
      tags: ['Games'],
      summary: 'List all games',
      response: {
        200: toJsonSchema(GameSchema.array()),
      },
    },
  }, async (_req, reply) => {
    const games = await prisma.game.findMany({
      orderBy: { scheduledTime: 'asc' },
      select: {
        id: true, storyFile: true, storyId: true, name: true,
        scheduledTime: true, startedAt: true,
        state: true, currentAct: true,
        locationText: true, createdAt: true, updatedAt: true,
      },
    })
    return reply.send(serializeDates(games))
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
    return reply.send(withCharacterNames({
      ...game,
      feed: game.events,
      storyTitle: runtimeStory.title,
      _characters: characters,
      storyId: game.storyFile,
      storyFile: game.storyFile,
    }))
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
    await prisma.gameEvent.create({
      data: {
        gameId: game.id,
        playerId: null,
        type: 'START_GAME',
        payload: { act: 1 },
      },
    })
    return reply.send(serializeDates(updated))
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
    let stageImage: string | null = null
    if (game.storyFile) {
      try {
        const raw = await loadStoryJson(game.storyFile)
        const runtimeStory = adaptGeneratedStoryToRuntime(raw).runtimeStory
        stageImage = runtimeStory.stageByAct?.[1]?.image ?? null
      } catch {
        stageImage = null
      }
    }
    await prisma.gameEvent.create({
      data: { gameId: game.id, playerId: null, type: 'START_GAME', payload: { act: 1, stageImage } },
    })
    return reply.send(serializeDates(updated))
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
    if (game.currentAct >= 5) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Already at final act. Use end-night to conclude.' })

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { currentAct: game.currentAct + 1 },
    })
    let stageImage: string | null = null
    if (game.storyFile) {
      try {
        const raw = await loadStoryJson(game.storyFile)
        const runtimeStory = adaptGeneratedStoryToRuntime(raw).runtimeStory
        stageImage = runtimeStory.stageByAct?.[updated.currentAct]?.image ?? null
      } catch {
        stageImage = null
      }
    }
    await prisma.gameEvent.create({
      data: { gameId: game.id, playerId: null, type: 'ADVANCE_ACT', payload: { act: updated.currentAct, stageImage } },
    })
    return reply.send(serializeDates(updated))
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

    await prisma.gameEvent.create({
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
          playerName: player.playerName,
          playerIndex: index >= 0 ? index : null,
        },
      },
    })
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
    if (player.game.state !== 'PLAYING') {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Game is not in PLAYING state' })
    }

    const runtimeRaw = player.game.storyFile ? await loadStoryJson(player.game.storyFile) : null
    const runtimeStory = runtimeRaw ? adaptGeneratedStoryToRuntime(runtimeRaw).runtimeStory : null
    const index = runtimeStory ? runtimeStory.playerOrder.indexOf(player.characterId) : -1
    const targetName =
      runtimeStory && typeof body.targetCharacterId === 'string'
        ? (runtimeStory.playersByCharacterId[body.targetCharacterId]?.name ?? null)
        : null

    await prisma.gameEvent.create({
      data: {
        gameId: player.gameId,
        playerId: player.id,
        type: 'POST_MOVE' as any,
        payload: {
          act: player.game.currentAct,
          moveType: body.moveType,
          text: typeof body.text === 'string' ? body.text : null,
          targetCharacterId: typeof body.targetCharacterId === 'string' ? body.targetCharacterId : null,
          targetName,
          characterId: player.characterId,
          playerName: player.playerName,
          playerIndex: index >= 0 ? index : null,
        },
      },
    })

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
    if (game.currentAct >= 5) return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Already at final act. Use end-night to conclude.' })

    const updated = await prisma.game.update({
      where: { id: game.id },
      data: { currentAct: game.currentAct + 1 },
    })
    await prisma.gameEvent.create({
      data: {
        gameId: game.id,
        playerId: null,
        type: 'ADVANCE_ACT',
        payload: { act: updated.currentAct },
      },
    })
    return reply.send(serializeDates(updated))
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

    await prisma.game.update({
      where: { id: game.id },
      data: { state: 'REVEAL' },
    })

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
    return reply.send(serializeDates(updated))
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
