import { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify'
import { OAuth2Client } from 'google-auth-library'
import { prisma } from '../lib/prisma.js'

const clientId = process.env.GOOGLE_CLIENT_ID?.trim() ?? ''
const googleClient = new OAuth2Client(clientId)

async function authRoutes(fastify: FastifyInstance) {
  // E2E/dev-only auth bypass.
  // Enables Playwright tests (and local dev) to create games without Google Sign-In.
  fastify.post('/auth/dev-login', async (request: FastifyRequest, reply: FastifyReply) => {
    if (process.env.NODE_ENV === 'production') {
      return reply.status(404).send({ statusCode: 404, error: 'Not Found', message: 'Route not found' })
    }

    const user = await prisma.user.upsert({
      where: { id: 'e2e-dev-user' },
      update: {
        email: 'e2e@example.com',
        name: 'E2E User',
        avatar: '',
      },
      create: {
        id: 'e2e-dev-user',
        email: 'e2e@example.com',
        name: 'E2E User',
        avatar: '',
      },
    })

    request.session.userId = user.id
    await request.session.save()

    return reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    })
  })

  // Google auth endpoint
  fastify.post('/auth/google', async (request: FastifyRequest<{ Body: { token: string } }>, reply: FastifyReply) => {
    const { token } = request.body ?? {}

    if (!clientId) {
      return reply.status(500).send({ statusCode: 500, error: 'Server Misconfiguration', message: 'GOOGLE_CLIENT_ID is not set' })
    }
    if (typeof token !== 'string' || !token.trim()) {
      return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Missing token' })
    }

    try {
      const ticket = await googleClient.verifyIdToken({
        idToken: token,
        audience: clientId,
      })

      const payload = ticket.getPayload()
      if (!payload || !payload.sub) {
        return reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Invalid token' })
      }

      const email = typeof payload.email === 'string' && payload.email.trim() ? payload.email.trim() : null
      if (!email) {
        return reply.status(400).send({
          statusCode: 400,
          error: 'Bad Request',
          message: 'Google did not return an email for this account; grant email scope or use an account with a verified email',
        })
      }

      const user = await prisma.user.upsert({
        where: { id: payload.sub },
        update: {
          email,
          name: payload.name || 'Unknown',
          avatar: payload.picture || '',
        },
        create: {
          id: payload.sub,
          email,
          name: payload.name || 'Unknown',
          avatar: payload.picture || '',
        },
      })

      // Set session
      request.session.userId = user.id
      await request.session.save()

      reply.send({
        id: user.id,
        email: user.email,
        name: user.name,
        avatar: user.avatar,
      })
    } catch (error) {
      fastify.log.error({ err: error }, 'Google auth error')
      reply.status(400).send({ statusCode: 400, error: 'Bad Request', message: 'Authentication failed' })
    }
  })

  // Get current user
  fastify.get('/auth/me', async (request: FastifyRequest, reply: FastifyReply) => {
    const userId = request.session.userId
    
    if (!userId) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'Not authenticated' })
    }

    const user = await prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return reply.status(401).send({ statusCode: 401, error: 'Unauthorized', message: 'User not found' })
    }

    reply.send({
      id: user.id,
      email: user.email,
      name: user.name,
      avatar: user.avatar,
    })
  })

  fastify.post('/auth/logout', async (request: FastifyRequest, reply: FastifyReply) => {
    await new Promise<void>((resolve, reject) => {
      request.session.destroy(err => (err ? reject(err) : resolve()))
    })
    reply.send({ ok: true })
  })
}

export default authRoutes
