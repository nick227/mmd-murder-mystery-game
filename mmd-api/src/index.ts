import Fastify from 'fastify'
import cookie from '@fastify/cookie'
import cors from '@fastify/cors'
import fastifySession from '@fastify/session'
import { swaggerPlugin } from './plugins/swagger.js'
import { storiesRoutes } from './routes/stories.js'
import { gamesRoutes } from './routes/games.js'
import { playersRoutes } from './routes/players.js'
import authRoutes from './routes/auth.js'
import { prisma } from './lib/prisma.js'

const PORT = parseInt(process.env.PORT ?? '3000', 10)
const HOST = process.env.HOST ?? '0.0.0.0'

/** @fastify/session requires secret length ≥ 32 */
const DEV_SESSION_FALLBACK = 'mmd-dev-only-session-secret-min-32-chars'

function resolveSessionSecret(): string {
  const raw = process.env.SESSION_SECRET?.trim()
  if (process.env.NODE_ENV === 'production') {
    if (!raw || raw.length < 32) {
      throw new Error('SESSION_SECRET is required in production and must be at least 32 characters')
    }
    return raw
  }
  if (raw && raw.length >= 32) return raw
  if (raw && raw.length < 32) {
    throw new Error('SESSION_SECRET must be at least 32 characters')
  }
  return DEV_SESSION_FALLBACK
}

/** Explicit origins only — never wildcard with credentials: true */
function corsOrigins(): string[] {
  if (process.env.CORS_ORIGIN?.trim()) {
    return process.env.CORS_ORIGIN.split(',').map(s => s.trim()).filter(Boolean)
  }
  return [
    'http://localhost:5173',
    'http://127.0.0.1:5173',
    'http://localhost:5178',
    'http://127.0.0.1:5178',
    'http://localhost:5180',
    'http://127.0.0.1:5180',
  ]
}

const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 7 // 7 days

async function buildApp() {
  const sessionSecret = resolveSessionSecret()

  const fastify = Fastify({
    trustProxy: process.env.TRUST_PROXY === 'true',
    logger: {
      level: process.env.NODE_ENV === 'production' ? 'warn' : 'info',
      // pino-pretty removed — install it separately if you want pretty logs:
      // npm install -D pino-pretty
      // then restore: transport: { target: 'pino-pretty', options: { translateTime: 'HH:MM:ss', ignore: 'pid,hostname' } }
    },
  })

  // ── CORS ───────────────────────────────────────────────────────────────────
  // Explicit origin list only (no wildcard) when credentials: true
  await fastify.register(cors, {
    origin: corsOrigins(),
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'x-host-key'],
    credentials: true,
  })

  // ── Session Support ─────────────────────────────────────────────────────────
  // @fastify/session requires @fastify/cookie to be registered first
  await fastify.register(cookie)
  // sameSite: 'lax' limits CSRF on cross-site POSTs; pair with explicit CORS origins
  await fastify.register(fastifySession, {
    secret: sessionSecret,
    cookieName: 'mmd_session',
    rolling: true,
    cookie: {
      path: '/',
      httpOnly: true,
      sameSite: 'lax',
      maxAge: SESSION_MAX_AGE_MS,
      secure: process.env.NODE_ENV === 'production',
    },
  })

  // ── Error handler ──────────────────────────────────────────────────────────
  fastify.setErrorHandler((error, _req, reply) => {
    const err = error as { statusCode?: number; name?: string; message?: string }
    const statusCode = err.statusCode ?? 500
    fastify.log.error(error)
    reply.status(statusCode).send({
      statusCode,
      error: err.name ?? 'Internal Server Error',
      message: err.message ?? 'Something went wrong',
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
  await fastify.register(authRoutes, { prefix: '/api/v1' })

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
