import type { EvidenceItem, FeedItem, ObjectiveItem } from '../data/types'

export function intentBadgeLabel(intent: ObjectiveItem['intent'] | undefined): string {
  if (intent === 'instruction') return 'Instruction'
  if (intent === 'clue') return 'Clue'
  if (intent === 'puzzle') return 'Puzzle'
  if (intent === 'reveal') return 'Reveal'
  if (intent === 'info') return 'Info'
  return ''
}

export function doNowIntentLabel(intent: ObjectiveItem['intent'] | undefined): string {
  // In the Do-now context we want the badge to feel like an action, not a type taxonomy.
  if (intent === 'instruction' || !intent) return 'Do'
  return intentBadgeLabel(intent)
}

export function evidenceKindLabel(kind: EvidenceItem['kind']): string {
  if (kind === 'clue') return 'Clue'
  if (kind === 'puzzle') return 'Puzzle'
  if (kind === 'reveal') return 'Reveal'
  if (kind === 'item') return 'Item'
  if (kind === 'treasure') return 'Treasure'
  if (kind === 'info') return 'Info'
  return 'Evidence'
}

export function feedDisplayLabel(item: FeedItem): string {
  if (typeof item.author === 'string' && item.author.trim()) return item.author
  if (item.variant === 'narration') return 'Narration'
  if (item.variant === 'mechanic') return 'Update'
  if (item.variant === 'social') return 'Player'
  return item.type
}

export function initialsFromName(name: string): string {
  const cleaned = name.trim().replace(/\s+/g, ' ')
  if (!cleaned) return '?'
  const parts = cleaned.split(' ').filter(Boolean)
  const first = parts[0]?.[0] ?? '?'
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? '') : ''
  return `${first}${last}`.toUpperCase()
}
