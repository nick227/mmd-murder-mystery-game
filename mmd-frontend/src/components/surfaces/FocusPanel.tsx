import type { EvidenceItem } from '../../data/types'
import { evidenceKindLabel } from '../../utils/uiText'
import { BottomSheet } from '../ui/BottomSheet'
import { Media } from '../ui/Media'

interface Props {
  item: EvidenceItem | null
  onClose: () => void
}

export function FocusPanel({ item, onClose }: Props) {
  if (!item) return null

  const media = item.image
    ? {
        kind: 'image' as const,
        src: item.image,
        alt: item.title,
        ratio: '16:9' as const,
        variant: 'hero' as const,
        fit: 'cover' as const,
        priority: false,
        sizes: '100vw',
        role: 'content' as const,
        fallback: { type: 'icon' as const, label: 'Evidence' },
      }
    : null

  return (
    <div data-testid="focus-sheet">
      <BottomSheet
        open={true}
        onClose={onClose}
        eyebrow={evidenceKindLabel(item.kind)}
        title={item.title}
        meta={typeof item.act === 'number' ? `Act ${item.act}` : ''}
      >
        {media ? (
          <div className="focus-sheet__media">
            <Media {...media} />
          </div>
        ) : null}

        <div className="focus-sheet__text">{item.text}</div>
      </BottomSheet>
    </div>
  )
}
