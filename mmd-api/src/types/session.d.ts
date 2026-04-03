/**
 * @fastify/session stores session payload on `Fastify.Session` (see plugin `types.d.ts`).
 * Augment here — there is no separate `declare module '@fastify/session'` Session export.
 */
import 'fastify'

declare module 'fastify' {
  interface Session {
    userId?: string
  }
}
