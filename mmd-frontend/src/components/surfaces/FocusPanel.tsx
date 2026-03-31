import type { EvidenceItem, FeedItem } from '../../data/types'
import { evidenceKindLabel, feedDisplayLabel } from '../../utils/uiText'
import { BottomSheet } from '../ui/BottomSheet'
import { Media } from '../ui/Media'
import { ChipRow } from '../ui/ChipRow'

export type FocusItem =
  | { kind: 'feed'; item: FeedItem }
  | { kind: 'evidence'; item: EvidenceItem }

interface Props {
  focus: FocusItem | null
  onClose: () => void
  isPinned?: (id: string) => boolean
  onTogglePin?: (id: string) => void
}

export function FocusPanel({ focus, onClose, isPinned, onTogglePin }: Props) {
  if (!focus) return null

  const header =
    focus.kind === 'feed'
      ? feedDisplayLabel(focus.item)
      : evidenceKindLabel(focus.item.kind)

  const title = focus.kind === 'feed'
    ? (focus.item.variant ? focus.item.variant.toUpperCase() : 'FEED')
    : focus.item.title

  const text =
    focus.kind === 'feed'
      ? focus.item.text
      : focus.item.text

  const meta =
    focus.kind === 'feed'
      ? (focus.item.timestamp ?? '')
      : (typeof focus.item.act === 'number' ? `Act ${focus.item.act}` : '')

  const media =
    focus.kind === 'feed'
      ? focus.item.media
      : focus.item.image
        ? {
            kind: 'image' as const,
            src: focus.item.image,
            ratio: '16:9' as const,
            variant: 'hero' as const,
            fit: 'cover' as const,
            priority: false,
            sizes: '100vw',
            role: 'content' as const,
            fallback: { type: 'icon' as const, label: 'Evidence' },
          }
        : null

  const id = focus.kind === 'feed' ? focus.item.id : focus.item.id
  const pinned = isPinned ? isPinned(id) : false

  return (
    <div data-testid="focus-sheet">
      <BottomSheet open={true} onClose={onClose} eyebrow={header} title={title} meta={meta}>
        <div className="focus-sheet__actions">
          {onTogglePin ? (
            <button className="mini-btn" onClick={() => onTogglePin(id)}>
              {pinned ? 'Unpin' : 'Pin'}
            </button>
          ) : null}
        </div>

        {focus.kind === 'feed' && Array.isArray(focus.item.chips) && focus.item.chips.length ? (
          <div style={{ marginBottom: 12 }}>
            <ChipRow chips={focus.item.chips} />
          </div>
        ) : null}

        {media ? (
          <div className="focus-sheet__media">
            <Media {...media} />
          </div>
        ) : null}

        <div className="focus-sheet__text">{text}</div>
      </BottomSheet>
    </div>
  )
}

