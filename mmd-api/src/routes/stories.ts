import { FastifyInstance } from 'fastify'
import { prisma } from '../lib/prisma.js'
import { toJsonSchema, serializeDates } from '../lib/utils.js'
import { StoryListItemSchema, StorySchema, ErrorSchema } from '../schemas/index.js'

export async function storiesRoutes(fastify: FastifyInstance) {

  // GET /stories — list all stories
  fastify.get('/stories', {
    schema: {
      tags: ['Stories'],
      summary: 'List all available stories',
      description: 'Returns all mystery story templates. Stories are static — they define characters, acts, mysteries, puzzles, and cards.',
      response: {
        200: toJsonSchema(StoryListItemSchema.array()),
        500: toJsonSchema(ErrorSchema),
      },
    },
  }, async (_req, reply) => {
    const stories = await prisma.story.findMany({
      orderBy: { createdAt: 'desc' },
      select: { id: true, title: true, summary: true, createdAt: true },
    })
    return reply.send(serializeDates(stories))
  })

  // GET /stories/:id — get full story
  fastify.get<{ Params: { id: string } }>('/stories/:id', {
    schema: {
      tags: ['Stories'],
      summary: 'Get a single story with full data',
      description: 'Returns the complete story blob including all characters, mysteries, puzzles, cards, acts, and solution (for story builders only — don\'t expose solution to players).',
      params: {
        type: 'object',
        properties: { id: { type: 'string', description: 'Story ID' } },
        required: ['id'],
      },
      response: {
        200: toJsonSchema(StorySchema),
        404: toJsonSchema(ErrorSchema),
      },
    },
  }, async (req, reply) => {
    const story = await prisma.story.findUnique({ where: { id: req.params.id } })
    if (!story) {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Story not found' })
    }
    return reply.send(serializeDates(story))
  })
}
