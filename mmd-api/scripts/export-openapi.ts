/**
 * Exports the OpenAPI spec to openapi.json
 * Usage: npm run openapi:export
 */
import Fastify from 'fastify'
import { swaggerPlugin } from '../src/plugins/swagger.js'
import { storiesRoutes } from '../src/routes/stories.js'
import { gamesRoutes } from '../src/routes/games.js'
import { playersRoutes } from '../src/routes/players.js'
import fs from 'fs'
import path from 'path'

async function exportOpenApi() {
  const fastify = Fastify({ logger: false })

  await fastify.register(swaggerPlugin)
  await fastify.register(storiesRoutes, { prefix: '/api/v1' })
  await fastify.register(gamesRoutes, { prefix: '/api/v1' })
  await fastify.register(playersRoutes, { prefix: '/api/v1' })

  await fastify.ready()

  const spec = fastify.swagger()
  const outPath = path.join(process.cwd(), 'openapi.json')
  fs.writeFileSync(outPath, JSON.stringify(spec, null, 2))

  console.log(`✓ OpenAPI spec exported to ${outPath}`)
  await fastify.close()
}

exportOpenApi().catch(console.error)
