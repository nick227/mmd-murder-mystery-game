import Fastify from 'fastify'
import cors from '@fastify/cors'
import { swaggerPlugin } from './plugins/swagger.js'
import { storiesRoutes } from './routes/stories.js'
import { gamesRoutes } from './routes/games.js'
import { playersRoutes } from './routes/players.js'
import { prisma } from './lib/prisma.js'

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const HOST = process.env.HOST ?? '0.0.0.0'

async function buildApp() {
  const fastify = Fastify({
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
      // pino-pretty removed — install it separately if you want pretty logs:
      // npm install -D pino-pretty
      // then restore: transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    },
  })

  // ── CORS ───────────────────────────────────────────────────────────────────
  // In dev, allow the Vite dev server. In production, set CORS_ORIGIN env var.
  await fastify.register(cors, {
    origin: process.env.CORS_ORIGIN
      ? process.env.CORS_ORIGIN.split(',').map(s => s.trim())
      : ['http://localhost:5173', 'http://127.0.0.1:5173'],
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-host-key'],
    credentials: false,
  })

  // ── Error handler ──────────────────────────────────────────────────────────
  fastify.setErrorHandler((error, _req, reply) => {
    const statusCode = error.statusCode ?? 500
    fastify.log.error(error)
    reply.status(statusCode).send({
      statusCode,
      error: error.name ?? 'Internal Server Error',
      message: error.message ?? 'Something went wrong',
    })
  })

  fastify.setNotFoundHandler((_req, reply) => {
    reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Route not found' })
  })

  // ── Plugins ────────────────────────────────────────────────────────────────
  await fastify.register(swaggerPlugin)

  // ── Health ─────────────────────────────────────────────────────────────────
  fastify.get('/health', {
    schema: {
      tags: ['System'],
      summary: 'Health check',
      response: {
        200: {
          type: 'object',
          properties: {
            status: { type: 'string' },
            timestamp: { type: 'string' },
            uptime: { type: 'number' },
          },
        },
      },
    },
  }, async (_req, reply) => {
    return reply.send({ status: 'ok', timestamp: new Date().toISOString(), uptime: process.uptime() })
  })

  // ── Routes ─────────────────────────────────────────────────────────────────
  await fastify.register(storiesRoutes, { prefix: '/api/v1' })
  await fastify.register(gamesRoutes, { prefix: '/api/v1' })
  await fastify.register(playersRoutes, { prefix: '/api/v1' })

  // ── Graceful shutdown ──────────────────────────────────────────────────────
  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal}, shutting down...`)
    await fastify.close()
    await prisma.$disconnect()
    process.exit(0)
  }
  process.on('SIGINT', () => shutdown('SIGINT'))
  process.on('SIGTERM', () => shutdown('SIGTERM'))

  return fastify
}

async function start() {
  try {
    const app = await buildApp()
    await app.listen({ port: PORT, host: HOST })
    app.log.info(`📖 OpenAPI docs: http://localhost:${PORT}/docs`)
    app.log.info(`🔍 Health check: http://localhost:${PORT}/health`)
  } catch (err) {
    console.error('Failed to start server:', err)
    await prisma.$disconnect()
    process.exit(1)
  }
}

start()
