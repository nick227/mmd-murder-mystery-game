import type { EvidenceItem } from '../data/types'

function evidenceKindRank(kind: EvidenceItem['kind']): number {
  // Prefer showing reveals first, then puzzles, then clues.
  if (kind === 'reveal') return 0
  if (kind === 'puzzle') return 1
  return 2
}

export function sortEvidence(items: EvidenceItem[]): EvidenceItem[] {
  // Stable ordering by act, then kind, then title (with an index tiebreaker).
  return items
    .map((item, index) => ({ item, index }))
    .sort((a, b) => {
      const actA = typeof a.item.act === 'number' ? a.item.act : 999
      const actB = typeof b.item.act === 'number' ? b.item.act : 999
      if (actA !== actB) return actA - actB

      const byKind = evidenceKindRank(a.item.kind) - evidenceKindRank(b.item.kind)
      if (byKind !== 0) return byKind

      const byTitle = a.item.title.localeCompare(b.item.title)
      if (byTitle !== 0) return byTitle

      return a.index - b.index
    })
    .map(x => x.item)
}

