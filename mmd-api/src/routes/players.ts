import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { toJsonSchema, validate, serializeDates } from '../lib/utils.js'
import {
  JoinGameBodySchema,
  PlayerViewSchema,
  SubmitObjectiveBodySchema,
  MessageSchema,
  ErrorSchema,
} from '../schemas/index.js'
import { loadStoryJson } from '../lib/storyJson.js'
import { adaptGeneratedStoryToRuntime } from '../lib/generatedRuntimeAdapter.js'
import { runtimeStoryToPlayerApiView } from '../lib/runtimeToApi.js'
import { attachRoomEventStream, publishRoomEvent } from '../lib/roomEvents.js'

function solvedActsFromEvents(game: any): number[] {
  const events: any[] = game.events ?? []
  const acts = new Set<number>()
  for (const event of events) {
    if (event.type !== 'SUBMIT_OBJECTIVE' && event.type !== 'SUBMISSION') continue
    const act = typeof event.payload?.act === 'number' ? event.payload.act : null
    if (act) acts.add(act)
  }
  return Array.from(acts).sort((a, b) => a - b)
}

async function loadRuntimeStoryForGame(game: any) {
  if (game.storyFile) {
    const raw = await loadStoryJson(game.storyFile)
    const { runtimeStory } = adaptGeneratedStoryToRuntime(raw)
    const storyImage = (raw as any)?.storyImage ?? runtimeStory.stageByAct?.[1]?.image ?? null
    return { runtimeStory, storyImage }
  }
  if (game.story?.dataJson) {
    // Legacy DB story blob is not supported for runtime adapter yet (hybrid mode expects storyFile).
    throw new Error('Game has storyId but no storyFile; hybrid mode requires storyFile.')
  }
  throw new Error('Game has no storyFile.')
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
          events: true,
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
          events: true,
        },
      },
    },
  })
}

async function joinPlayerSlot(player: any, playerName: string, userId?: string) {
  const updated = await prisma.gamePlayer.update({
    where: { id: player.id },
    data: {
      playerName,
      joinedAt: player.joinedAt ?? new Date(),
      userId: userId ?? null, // Attach user ID if available
    },
  })
  return prisma.gameEvent.create({
    data: {
      gameId: updated.gameId,
      playerId: updated.id,
      type: 'JOIN',
      payload: { characterId: updated.characterId, playerName: updated.playerName },
    },
  })
}

async function buildPlayerView(player: any) {
  const { runtimeStory, storyImage } = await loadRuntimeStoryForGame(player.game)
  const view = runtimeStoryToPlayerApiView({
    story: runtimeStory,
    storyImage,
    game: player.game,
    me: { id: player.id, characterId: player.characterId, playerName: player.playerName },
    solvedActs: solvedActsFromEvents(player.game),
    feed: player.game.events,
  })
  return serializeDates(view)
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
      const userId = req.session.userId
      const event = await joinPlayerSlot(player, body.playerName, userId)
      publishRoomEvent({ gameId: player.gameId, eventId: event.id, eventType: String(event.type) })
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
      const userId = req.session.userId
      const event = await joinPlayerSlot(player, body.playerName, userId)
      publishRoomEvent({ gameId: player.gameId, eventId: event.id, eventType: String(event.type) })
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
      return reply.send(await buildPlayerView(player))
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
      return reply.send(await buildPlayerView(player))
    }
  )

  fastify.get<{ Params: { gameId: string; characterId: string } }>(
    '/play/:gameId/character/:characterId/stream',
    {
      schema: {
        tags: ['Players'],
        summary: 'Subscribe to room updates by character id',
        params: {
          type: 'object',
          properties: {
            gameId: { type: 'string' },
            characterId: { type: 'string' },
          },
          required: ['gameId', 'characterId'],
        },
        response: {},
      },
    },
    async (req, reply) => {
      const player = await findPlayerByCharacter(req.params.gameId, req.params.characterId)
      if (!player) {
        return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Invalid game link' })
      }

      reply.hijack()
      attachRoomEventStream(player.gameId, reply.raw)
      return reply
    }
  )

  fastify.post<{ Params: { gameId: string; characterId: string } }>(
    '/play/:gameId/character/:characterId/submit',
    {
      schema: {
        tags: ['Players'],
        summary: 'Submit an objective/card (session event)',
        params: {
          type: 'object',
          properties: { gameId: { type: 'string' }, characterId: { type: 'string' } },
          required: ['gameId', 'characterId'],
        },
        body: toJsonSchema(SubmitObjectiveBodySchema),
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
      const body = validate(SubmitObjectiveBodySchema, req.body)

      const { runtimeStory } = await loadRuntimeStoryForGame(player.game)
      const playerIndex = runtimeStory.playerOrder.indexOf(player.characterId)
      const characterName = runtimeStory.playersByCharacterId[player.characterId]?.name ?? null
      const submittedCard = runtimeStory.cards.find(card => card.id === body.objectiveId) ?? null

      const event = await prisma.gameEvent.create({
        data: {
          gameId: player.gameId,
          playerId: player.id,
          type: 'SUBMIT_OBJECTIVE',
          payload: {
            objectiveId: body.objectiveId,
            act: player.game.currentAct,
            characterId: player.characterId,
            characterName,
            playerName: player.playerName,
            playerIndex: playerIndex >= 0 ? playerIndex : null,
            cardTitle: submittedCard?.title ?? null,
            cardText: submittedCard?.text ?? null,
          },
        },
      })
      publishRoomEvent({ gameId: player.gameId, eventId: event.id, eventType: String(event.type) })
      return reply.send({ message: 'Submitted' })
    },
  )
}
