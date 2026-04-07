import { FastifyInstance } from 'fastify'
import { toJsonSchema, serializeDates } from '../lib/utils.js'
import { StoryListItemSchema, StorySchema, ErrorSchema } from '../schemas/index.js'
import { listStoryFiles, loadStoryJson } from '../lib/storyJson.js'
import { adaptGeneratedStoryToRuntime } from '../lib/generatedRuntimeAdapter.js'

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
    const files = await listStoryFiles()
    const stories = await Promise.all(files.map(async item => {
      try {
        const raw = await loadStoryJson(item.file)
        const { runtimeStory } = adaptGeneratedStoryToRuntime(raw)
        const rawCards = Array.isArray((raw as any)?.cards) ? ((raw as any).cards as Array<Record<string, unknown>>) : []
        const storyMeta = rawCards
          .filter(card => card?.card_type === 'story_meta')
          .map(card => ({
            key: typeof card.card_title === 'string' ? card.card_title : '',
            value: typeof card.card_contents === 'string' ? card.card_contents : '',
          }))
          .filter(entry => entry.key.length > 0 || entry.value.length > 0)
        const cardCount = rawCards.length
        const characterCount = rawCards.filter(card => card?.card_type === 'character').length
        const clueCount = rawCards.filter(card => card?.card_type === 'clue').length
        const puzzleCount = rawCards.filter(card => card?.card_type === 'puzzle').length
        const secretCount = rawCards.filter(card => card?.card_type === 'secret').length
        const characters = runtimeStory.playerOrder
          .map(id => runtimeStory.playersByCharacterId[id])
          .filter(Boolean)
          .map(player => ({
            characterId: player.characterId,
            name: player.name,
            archetype: player.archetype,
            portrait: player.image,
          }))
        const image = (raw as any)?.storyImage ?? runtimeStory.stageByAct?.[1]?.image
        return {
          id: item.file,
          title: runtimeStory.title,
          summary: runtimeStory.summary,
          image,
          storyMeta: storyMeta.length ? storyMeta : undefined,
          characterCount,
          cardCount,
          clueCount,
          puzzleCount,
          secretCount,
          characters,
          createdAt: item.createdAt,
        }
      } catch {
        return {
          id: item.file,
          title: item.file.replace(/\.json$/i, ''),
          summary: 'Generated story JSON file.',
          createdAt: item.createdAt,
        }
      }
    }))
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
    try {
      const raw = await loadStoryJson(req.params.id)
      const { runtimeStory } = adaptGeneratedStoryToRuntime(raw)
      return reply.send(serializeDates({
        id: req.params.id,
        title: runtimeStory.title,
        summary: runtimeStory.summary,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        dataJson: raw,
      }))
    } catch {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Story not found' })
    }
  })
}
