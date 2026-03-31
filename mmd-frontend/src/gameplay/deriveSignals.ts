import type { ApiGameEvent, HeatItem, TimelinePin } from '../data/types'

export function deriveHeatFromEvents(input: { events: ApiGameEvent[]; roomPlayers: Array<{ characterId: string; name: string }> }): HeatItem[] {
  const heatByCharacterId = new Map<string, number>()

  for (const ev of input.events) {
    if (ev.type !== 'POST_MOVE') continue
    const payload = ev.payload ?? {}
    const moveType = typeof (payload as any).moveType === 'string' ? String((payload as any).moveType) : ''
    const targetCharacterId = typeof (payload as any).targetCharacterId === 'string'
      ? String((payload as any).targetCharacterId)
      : null
    if (!targetCharacterId) continue
    if (moveType !== 'suspect' && moveType !== 'accuse') continue
    const delta = moveType === 'accuse' ? 2 : 1
    heatByCharacterId.set(targetCharacterId, (heatByCharacterId.get(targetCharacterId) ?? 0) + delta)
  }

  return input.roomPlayers
    .map(p => ({
      characterId: p.characterId,
      name: p.name,
      heat: heatByCharacterId.get(p.characterId) ?? 0,
    }))
    .filter(item => item.heat > 0)
    .sort((a, b) => b.heat - a.heat || a.name.localeCompare(b.name))
}

export function deriveTimelinePinsFromEvents(input: { events: ApiGameEvent[] }): TimelinePin[] {
  const pins: TimelinePin[] = []

  for (const ev of input.events) {
    if (ev.type !== 'POST_MOVE') continue
    const payload = ev.payload ?? {}
    const moveType = typeof (payload as any).moveType === 'string' ? String((payload as any).moveType) : ''
    const textBody = typeof (payload as any).text === 'string' ? String((payload as any).text) : ''
    const act = typeof (payload as any).act === 'number' ? Number((payload as any).act) : undefined

    if (moveType !== 'searched' && moveType !== 'solved') continue

    const label = moveType === 'solved'
      ? (textBody ? `Solved: ${textBody}` : 'Solved a puzzle')
      : (textBody ? `Searched: ${textBody}` : 'Searched')

    pins.push({ id: `pin-${ev.id}`, label, act, sourceFeedId: ev.id })
  }

  return pins
}

