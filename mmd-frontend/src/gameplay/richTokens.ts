import type { FeedItem } from '../data/types'

export type RichChip = NonNullable<FeedItem['chips']>[number]

const pattern = /\[\[(suspect|clue|location):([^\]|]+)\|([^\]|]+)(?:\|([^\]]+))?\]\]/g

export function parseRichTokens(raw: string): { text: string; chips: FeedItem['chips'] } {
  const chips: RichChip[] = []
  let match: RegExpExecArray | null
  while ((match = pattern.exec(raw))) {
    const kind = match[1] as RichChip['kind']
    const id = match[2] ? String(match[2]) : undefined
    const label = match[3] ? String(match[3]) : ''
    const image = match[4] ? decodeURIComponent(String(match[4])) : undefined
    chips.push({ kind, id, label, image })
  }
  const text = raw.replace(pattern, '').replace(/\s{2,}/g, ' ').trim()
  return { text, chips: chips.length ? chips : undefined }
}

export function encodeClueToken(input: { id: string; label: string; image?: string | undefined }): string {
  return `[[clue:${input.id}|${input.label}|${input.image ? encodeURIComponent(input.image) : ''}]]`
}

export function encodeLocationToken(input: { id: string; label: string }): string {
  return `[[location:${encodeURIComponent(input.id)}|${input.label}]]`
}

export function buildMoveChips(input: {
  moveType: string
  targetName: string | null
  chips: FeedItem['chips']
}): FeedItem['chips'] {
  const out: RichChip[] = []
  if ((input.moveType === 'suspect' || input.moveType === 'accuse') && input.targetName) {
    out.push({ kind: 'suspect', label: input.targetName })
  }
  for (const chip of input.chips ?? []) out.push(chip)
  return out.length ? out : undefined
}

