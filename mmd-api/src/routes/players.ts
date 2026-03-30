import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { toJsonSchema, validate, serializeDates } from '../lib/utils.js'
import {
  JoinGameBodySchema,
  PlayerViewSchema,
  MessageSchema,
  ErrorSchema,
} from '../schemas/index.js'
import {
  filterByAct,
  getCharacter,
  stripMysteryAnswers,
  stripPuzzleAnswers,
} from '../lib/actGating.js'

function buildPlayerView(player: any) {
  const { game } = player
  const storyData = game.story.dataJson as any
  const currentAct = game.currentAct
  const character = getCharacter(storyData, player.characterId) ?? {
    id: player.characterId,
    name: `Character ${player.characterId}`,
    biography: '',
    secrets: [],
    items: [],
  }

  const allMysteries: any[] = storyData?.mysteries ?? []
  const allPuzzles: any[] = storyData?.puzzles ?? []
  const allCards: any[] = storyData?.cards ?? []

  const unlockedMysteries = stripMysteryAnswers(filterByAct(allMysteries, currentAct))
  const unlockedPuzzles = stripPuzzleAnswers(filterByAct(allPuzzles, currentAct))
  const unlockedCards = filterByAct(allCards, currentAct).filter((card: any) => {
    return !card.characterId || card.characterId === player.characterId
  })

  const mysteryAnswers = game.state === 'REVEAL'
    ? game.mysteryAnswers.map((answer: any) => ({ track: answer.track, answer: answer.answer }))
    : undefined

  return {
    gameId: game.id,
    gameName: game.name,
    gameState: game.state,
    currentAct: game.currentAct,
    scheduledTime: game.scheduledTime.toISOString(),
    locationText: game.locationText,
    stage: null,
    feed: [],
    roomPlayers: game.players.map((roomPlayer: any) => ({
      id: roomPlayer.id,
      characterId: roomPlayer.characterId,
      playerName: roomPlayer.playerName,
      joinedAt: roomPlayer.joinedAt,
    })),
    playerId: player.id,
    characterId: player.characterId,
    playerName: player.playerName,
    character,
    unlockedMysteries,
    unlockedPuzzles,
    unlockedCards,
    mysteryAnswers,
  }
}

async function findPlayerByLogin(gameId: string, loginKey: string) {
  return prisma.gamePlayer.findFirst({
    where: { gameId, loginKey },
    include: {
      game: {
        include: {
          story: true,
          mysteryAnswers: true,
          players: true,
        },
      },
    },
  })
}

async function findPlayerByCharacter(gameId: string, characterId: string) {
  return prisma.gamePlayer.findFirst({
    where: { gameId, characterId },
    include: {
      game: {
        include: {
          story: true,
          mysteryAnswers: true,
          players: true,
        },
      },
    },
  })
}

async function joinPlayerSlot(player: any, playerName: string) {
  await prisma.gamePlayer.update({
    where: { id: player.id },
    data: {
      playerName,
      joinedAt: player.joinedAt ?? new Date(),
    },
  })
}

export async function playersRoutes(fastify: FastifyInstance) {

  fastify.post<{ Params: { gameId: string; loginKey: string } }>(
    '/play/:gameId/:loginKey/join',
    {
      schema: {
        tags: ['Players'],
        summary: 'Join a game as a player',
        params: {
          type: 'object',
          properties: {
            gameId: { type: 'string' },
            loginKey: { type: 'string' },
          },
          required: ['gameId', 'loginKey'],
        },
        body: toJsonSchema(JoinGameBodySchema),
        response: {
          200: toJsonSchema(MessageSchema),
          400: toJsonSchema(ErrorSchema),
          404: toJsonSchema(ErrorSchema),
        },
      },
    },
    async (req, reply) => {
      const player = await findPlayerByLogin(req.params.gameId, req.params.loginKey)
      if (!player) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid game link' })
      }

      const body = validate(JoinGameBodySchema, req.body)
      await joinPlayerSlot(player, body.playerName)
      return reply.send({ message: `Welcome, ${body.playerName}!` })
    }
  )

  fastify.post<{ Params: { gameId: string; characterId: string } }>(
    '/play/:gameId/character/:characterId/join',
    {
      schema: {
        tags: ['Players'],
        summary: 'Join a game as a player by character id',
        params: {
          type: 'object',
          properties: {
            gameId: { type: 'string' },
            characterId: { type: 'string' },
          },
          required: ['gameId', 'characterId'],
        },
        body: toJsonSchema(JoinGameBodySchema),
        response: {
          200: toJsonSchema(MessageSchema),
          400: toJsonSchema(ErrorSchema),
          404: toJsonSchema(ErrorSchema),
        },
      },
    },
    async (req, reply) => {
      const player = await findPlayerByCharacter(req.params.gameId, req.params.characterId)
      if (!player) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid game link' })
      }

      const body = validate(JoinGameBodySchema, req.body)
      await joinPlayerSlot(player, body.playerName)
      return reply.send({ message: `Welcome, ${body.playerName}!` })
    }
  )

  fastify.get<{ Params: { gameId: string; loginKey: string } }>(
    '/play/:gameId/:loginKey',
    {
      schema: {
        tags: ['Players'],
        summary: 'Get player dashboard by login key',
        params: {
          type: 'object',
          properties: {
            gameId: { type: 'string' },
            loginKey: { type: 'string' },
          },
          required: ['gameId', 'loginKey'],
        },
        response: {
          200: toJsonSchema(PlayerViewSchema),
          404: toJsonSchema(ErrorSchema),
        },
      },
    },
    async (req, reply) => {
      const player = await findPlayerByLogin(req.params.gameId, req.params.loginKey)
      if (!player) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid game link' })
      }
      return reply.send(serializeDates(buildPlayerView(player)))
    }
  )

  fastify.get<{ Params: { gameId: string; characterId: string } }>(
    '/play/:gameId/character/:characterId',
    {
      schema: {
        tags: ['Players'],
        summary: 'Get player dashboard by character id',
        params: {
          type: 'object',
          properties: {
            gameId: { type: 'string' },
            characterId: { type: 'string' },
          },
          required: ['gameId', 'characterId'],
        },
        response: {
          200: toJsonSchema(PlayerViewSchema),
          404: toJsonSchema(ErrorSchema),
        },
      },
    },
    async (req, reply) => {
      const player = await findPlayerByCharacter(req.params.gameId, req.params.characterId)
      if (!player) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid game link' })
      }
      return reply.send(serializeDates(buildPlayerView(player)))
    }
  )
}
