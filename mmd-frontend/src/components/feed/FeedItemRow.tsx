import type { FeedItem, StageData } from '../../data/types'
import { feedDisplayLabel } from '../../utils/uiText'
import { Media } from '../ui/Media'
import { ChipRow } from '../ui/ChipRow'

interface Props {
  item: FeedItem
  stage?: StageData
  onClick?: (item: FeedItem) => void
}

export function FeedItemRow({ item, stage, onClick }: Props) {
  const variant = item.variant ?? 'room'
  const klass = [
    'feed-item',
    `feed-item--${item.type}`,
    `feed-item--variant-${variant}`,
    item.layout === 'cinematic' ? 'feed-item--cinematic' : '',
    item.stacking ? `feed-item--stack-${item.stacking}` : '',
  ].join(' ')

  return (
    <article
      key={item.id}
      className={onClick ? `${klass} is-clickable` : klass}
      data-variant={variant}
      data-testid="feed-item"
      role={onClick ? 'group' : undefined}
      tabIndex={onClick ? -1 : undefined}
      onClick={onClick ? () => onClick(item) : undefined}
    >
      {Array.isArray(item.chips) && item.chips.length ? <ChipRow chips={item.chips} /> : null}
      {typeof item.actDivider === 'number' ? (
        <div className="feed-act-divider" data-act={item.actDivider}>
          <div className="feed-act-divider__label">{`ACT ${item.actDivider}`}</div>
          <div className="feed-act-divider__subtitle">{stage?.title ?? ''}</div>
          <div className="feed-act-divider__body">{stage?.description ?? ''}</div>
        </div>
      ) : null}
      {item.media?.src ? (
        <div style={{ marginBottom: 10 }}>
          <Media
            {...item.media}
            kind={item.media.kind ?? 'image'}
            ratio={item.media.ratio ?? (variant === 'narration' ? '16:9' : 'auto')}
            variant={item.media.variant ?? (variant === 'narration' ? 'hero' : 'card')}
            fit={item.media.fit ?? (variant === 'narration' ? 'cover' : 'contain')}
            priority={item.media.priority ?? (variant === 'narration')}
            role={item.media.role ?? (variant === 'narration' ? 'decorative' : 'content')}
            sizes={item.media.sizes ?? (variant === 'narration' ? '100vw' : '(max-width: 768px) 100vw, 480px')}
            fallback={item.media.fallback ?? { type: 'gradient' }}
          />
        </div>
      ) : null}
      <div className="feed-item__top">
        <span>{feedDisplayLabel(item)}</span>
        <span>{item.timestamp ?? ''}</span>
      </div>
      {item.visibility ? <div className="feed-item__visibility">{item.visibility}</div> : null}
      <div className="feed-item__text">{item.text}</div>
    </article>
  )
}

