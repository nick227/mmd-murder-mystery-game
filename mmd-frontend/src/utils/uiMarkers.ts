/** DevTools-oriented markers; see `docs/ui-devtools-conventions.md`. */

export type SurfaceId = 'lobby' | 'game' | 'profile'

/** `data-surface` on the app shell only (single owner). */
export type AppShellSurface = 'launcher' | 'host' | SurfaceId

/** `data-ui` must match the **exported component name** in its `.tsx` file (PascalCase). */

export function ui(name: string): { 'data-ui': string } {
  return { 'data-ui': name }
}

/**
 * `data-action` values must be verbs only (join, post, start, finish, reload, invite, advance, …).
 * Maps host action ids to verbs when the id is not already a verb.
 */
export function actionVerb(actionId: string): string {
  if (actionId === 'next') return 'advance'
  return actionId
}
