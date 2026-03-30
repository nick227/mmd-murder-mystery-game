import { FastifyInstance } from 'fastify'
import swagger from '@fastify/swagger'
import swaggerUi from '@fastify/swagger-ui'

export async function swaggerPlugin(fastify: FastifyInstance) {
  await fastify.register(swagger, {
    openapi: {
      openapi: '3.0.0',
      info: {
        title: 'Murder Mystery Dinner API',
        description: `
## MMD Platform API

Host-driven, read-only-player game engine for murder mystery dinner parties.

### Auth model
- **Host actions** require \`X-Host-Key\` header (returned on game creation)
- **Player actions** use a \`loginKey\` in the URL path — no password needed

### State machine
\`\`\`
SCHEDULED → PLAYING → REVEAL → DONE
\`\`\`

### Act gating
Content (puzzles, cards, mysteries) has an \`act\` field. Players only see items where \`act <= currentAct\`.
Poll \`GET /play/:gameId/:loginKey\` every 5–10s to stay in sync.
        `.trim(),
        version: '1.0.0',
        contact: { name: 'MMD Platform' },
      },
      components: {
        securitySchemes: {
          HostKey: {
            type: 'apiKey',
            in: 'header',
            name: 'X-Host-Key',
            description: 'Host authentication key returned on game creation',
          },
        },
      },
      tags: [
        { name: 'Stories', description: 'Story templates — static, reusable mystery definitions' },
        { name: 'Games', description: 'Game sessions — runtime instances of a story' },
        { name: 'Host Actions', description: 'State transitions — only the host can call these' },
        { name: 'Players', description: 'Player endpoints — read-only views, act-gated content' },
      ],
    },
  })

  await fastify.register(swaggerUi, {
    routePrefix: '/docs',
    uiConfig: {
      docExpansion: 'list',
      deepLinking: true,
      defaultModelsExpandDepth: 2,
      displayRequestDuration: true,
    },
    staticCSP: true,
    transformStaticCSP: (header) => header,
  })
}
