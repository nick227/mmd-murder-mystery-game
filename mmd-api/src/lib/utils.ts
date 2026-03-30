import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'

/**
 * Converts a Zod schema to a JSON Schema object suitable for Fastify route schemas.
 * Strips the $schema key that zod-to-json-schema adds at the root.
 */
export function toJsonSchema(schema: z.ZodTypeAny): object {
  const jsonSchema = zodToJsonSchema(schema, { target: 'jsonSchema7' }) as Record<string, unknown>
  const { $schema, ...rest } = jsonSchema
  return rest
}

/**
 * Wraps a zod validator for use in route handlers.
 * Throws a 400 with a readable message if validation fails.
 */
export function validate<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const messages = result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join(', ')
    throw { statusCode: 400, message: messages }
  }
  return result.data
}

/** Generates a random URL-safe key */
export function generateKey(prefix: string): string {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789'
  const random = Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
  return `${prefix}_${random}`
}

/** Serializes dates to ISO strings for API responses */
export function serializeDates<T extends object>(obj: T): T {
  return JSON.parse(JSON.stringify(obj, (_key, value) => {
    if (value instanceof Date) return value.toISOString()
    return value
  }))
}
