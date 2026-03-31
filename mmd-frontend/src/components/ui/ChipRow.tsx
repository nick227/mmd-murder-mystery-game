import type { FeedItem } from '../../data/types'
import { Media } from './Media'

interface Props {
  chips: NonNullable<FeedItem['chips']>
}

export function ChipRow({ chips }: Props) {
  if (!chips.length) return null
  return (
    <div className="chip-row" data-testid="chip-row">
      {chips.map((chip, idx) => (
        <span
          key={`${chip.kind}-${chip.id ?? chip.label}-${idx}`}
          className={`chip chip--${chip.kind}${chip.image ? ' chip--has-media' : ''}`}
        >
          {chip.image ? (
            <span className="chip__media" aria-hidden="true">
              <Media
                kind="image"
                src={chip.image}
                alt=""
                ratio="1:1"
                variant="thumb"
                fit="cover"
                priority={false}
                sizes="18px"
                role="decorative"
                fallback={{ type: 'icon' }}
              />
            </span>
          ) : null}
          <span className="chip__label">{chip.label}</span>
        </span>
      ))}
    </div>
  )
}

