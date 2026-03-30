import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { toJsonSchema, validate, generateKey, serializeDates } from '../lib/utils.js'
import {
  CreateGameBodySchema,
  GameSchema,
  GameHostViewSchema,
  AssignCharacterBodySchema,
  SubmitAnswersBodySchema,
  MysteryAnswerSchema,
  MessageSchema,
  ErrorSchema,
} from '../schemas/index.js'

function withCharacterNames(game: any) {
  const storyData = game.story?.dataJson as any
  const characters: any[] = storyData?.characters ?? []
  return {
    ...serializeDates(game),
    storyTitle: game.story?.title ?? game.name,
    players: game.players.map((player: any) => {
      const character = characters.find((item: any) => item.id === player.characterId)
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

    const story = await prisma.story.findUnique({ where: { id: body.storyId } })
    if (!story) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Story not found' })
    }

    const storyData = story.dataJson as any
    const characters: any[] = storyData?.characters ?? []

    const game = await prisma.game.create({
      data: {
        storyId: body.storyId,
        name: body.name,
        hostKey: generateKey('host'),
        scheduledTime: new Date(body.scheduledTime),
        locationText: body.locationText ?? null,
        players: {
          create: characters.map((char: any) => ({
            characterId: char.id,
            loginKey: generateKey('char'),
          })),
        },
      },
      include: { players: true, story: true },
    })

    return reply.status(201).send(withCharacterNames(game))
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
        id: true, storyId: true, name: true,
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
      include: { players: true, story: true },
    })
    if (!game) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Game not found' })
    }
    const hostKey = req.headers['x-host-key']
    if (hostKey !== game.hostKey) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Invalid host key' })
    }
    return reply.send(withCharacterNames(game))
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
    return reply.send(serializeDates(updated))
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
