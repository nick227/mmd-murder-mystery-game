import fs from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

function localStoryJsonPlugin(): Plugin {
  const storyDir = path.resolve(process.cwd(), '..', 'mmd-api', 'json')
  const eventsByGameId = new Map<string, Array<Record<string, unknown>>>()

  return {
    name: 'mmd-local-story-json',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (!req.url) return next()
        const pathname = req.url.split('?')[0] ?? req.url

        if (pathname === '/__local_stories') {
          try {
            const files = fs
              .readdirSync(storyDir, { withFileTypes: true })
              .filter(entry => entry.isFile() && entry.name.toLowerCase().endsWith('.json'))
              .map(entry => entry.name)
              .sort((a, b) => a.localeCompare(b))

            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ files }))
          } catch (err) {
            res.statusCode = 500
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Failed to read story directory' }))
          }
          return
        }

        const prefix = '/__local_story/'
        if (pathname.startsWith(prefix)) {
          const filename = decodeURIComponent(pathname.slice(prefix.length)) ?? ''
          const filePath = path.resolve(storyDir, filename)

          if (!filePath.startsWith(storyDir + path.sep)) {
            res.statusCode = 400
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Invalid story path' }))
            return
          }

          try {
            const json = fs.readFileSync(filePath, 'utf8')
            res.statusCode = 200
            res.setHeader('Content-Type', 'application/json')
            res.end(json)
          } catch (err) {
            res.statusCode = 404
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Story file not found' }))
          }
          return
        }

        const eventsPrefix = '/__local_events/'
        if (pathname.startsWith(eventsPrefix)) {
          const gameId = decodeURIComponent(pathname.slice(eventsPrefix.length)) ?? ''
          const events = eventsByGameId.get(gameId) ?? []
          res.statusCode = 200
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ events }))
          return
        }

        const eventPrefix = '/__local_event/'
        if (pathname.startsWith(eventPrefix)) {
          const gameIdFromPath = decodeURIComponent(pathname.slice(eventPrefix.length)) ?? ''
          if (req.method !== 'POST') {
            res.statusCode = 405
            res.setHeader('Content-Type', 'application/json')
            res.end(JSON.stringify({ error: 'Method not allowed' }))
            return
          }

          let body = ''
          req.on('data', chunk => { body += String(chunk) })
          req.on('end', () => {
            try {
              if (!gameIdFromPath) throw new Error('Missing gameId')
              const parsed = JSON.parse(body) as { event?: unknown }
              const event = typeof parsed.event === 'object' && parsed.event ? (parsed.event as Record<string, unknown>) : null
              if (!event) throw new Error('Missing event')
              const list = eventsByGameId.get(gameIdFromPath) ?? []
              list.push(event)
              eventsByGameId.set(gameIdFromPath, list.slice(-500))
              res.statusCode = 200
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ ok: true }))
            } catch (err) {
              res.statusCode = 400
              res.setHeader('Content-Type', 'application/json')
              res.end(JSON.stringify({ error: err instanceof Error ? err.message : 'Bad request' }))
            }
          })
          return
        }

        next()
      })
    },
  }
}

export default defineConfig({
  plugins: [react(), localStoryJsonPlugin()],
  server: {
    port: 5173,
    // Dev proxy: forwards /api/* to the backend on :3000, avoiding CORS in dev
    proxy: {
      '/api': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
      '/health': {
        target: 'http://localhost:3000',
        changeOrigin: true,
      },
    },
  },
})
