import { loadStoryJson } from './storyJson.js'
import { adaptGeneratedStoryToRuntime } from './generatedRuntimeAdapter.js'

export async function readSolutionAnnouncements(storyFile: string | null): Promise<Array<Record<string, unknown>>> {
  if (!storyFile) return []
  try {
    const raw = await loadStoryJson(storyFile)
    const cards = (raw as any).cards ?? []
    const solutions = cards.filter((c: any) => c.card_type === 'solution' && c.reveal === 'host_reveal')
    solutions.sort((a: any, b: any) => {
      const order: Record<string, number> = { murder: 0, treasure: 1 }
      return (order[a.role ?? ''] ?? 99) - (order[b.role ?? ''] ?? 99)
    })

    const announcements: Array<Record<string, unknown>> = []
    for (const card of solutions) {
      const title = typeof card.card_title === 'string' ? card.card_title.trim() : ''
      const text = typeof card.card_contents === 'string' ? card.card_contents.trim() : ''
      const message = `${title ? `${title}\n` : ''}${text}`.trim()
      if (!message) continue

      announcements.push({
        message,
        cardType: 'solution',
        cardId: card.card_id ?? null,
        role: card.role ?? null,
        revealedByHost: true,
      })
    }
    return announcements
  } catch {
    return []
  }
}
