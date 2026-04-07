import { useEffect, useMemo, useState } from 'react'
import type { EvidenceItem } from '../../data/types'
import { evidenceKindLabel } from '../../utils/uiText'
import { sortEvidence } from '../../utils/sort'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'
import { Media } from '../ui/Media'

interface Props {
  items: EvidenceItem[]
  title?: string
  currentAct?: number
  onItemClick?: (item: EvidenceItem) => void
}

export function EvidenceSection({ items, title = 'Evidence', currentAct, onItemClick }: Props) {
  const ordered = sortEvidence(items)
  const availableKinds = useMemo(() => {
    const preferredOrder: EvidenceItem['kind'][] = ['clue', 'puzzle', 'item', 'treasure', 'info', 'reveal']
    return preferredOrder.filter(kind => ordered.some(item => item.kind === kind))
  }, [ordered])
  const defaultKind: EvidenceItem['kind'] = availableKinds.includes('clue') ? 'clue' : (availableKinds[0] ?? 'clue')
  const [activeKind, setActiveKind] = useState<EvidenceItem['kind']>(defaultKind)
  const hasNewRevealForAct = useMemo(() => {
    if (currentAct === undefined) return false
    return ordered.some(item => item.kind === 'reveal' && item.act === currentAct)
  }, [currentAct, ordered])

  useEffect(() => {
    if (!availableKinds.includes(activeKind)) {
      setActiveKind(defaultKind)
    }
  }, [activeKind, availableKinds, defaultKind])

  useEffect(() => {
    if (hasNewRevealForAct && activeKind !== 'reveal' && availableKinds.includes('reveal')) {
      setActiveKind('reveal')
    }
  }, [activeKind, availableKinds, hasNewRevealForAct])

  if (!items.length) return null

  const visibleItems = ordered.filter(item => item.kind === activeKind)
  const imageFromEvidence = (item: EvidenceItem): string | undefined => {
    const anyItem = item as unknown as {
      image?: unknown
      image_url?: unknown
      imageUrl?: unknown
      card_image?: unknown
    }
    const candidates = [anyItem.image, anyItem.image_url, anyItem.imageUrl, anyItem.card_image]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim()
    }
    return undefined
  }

  return (
    <Panel testId="evidence-section">
      <PanelHeader title={title} />
      <div className="chip-row evidence-filter-row" role="tablist" aria-label="Filter evidence by type">
        {availableKinds.map(kind => (
          <button
            key={kind}
            type="button"
            className={[
              'chip',
              `chip--${kind}`,
              'chip--button',
              activeKind === kind ? 'chip--active' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => setActiveKind(kind)}
            role="tab"
            aria-selected={activeKind === kind}
            data-testid={`evidence-filter-${kind}`}
          >
            <span className="chip__label">{evidenceKindLabel(kind)}</span>
          </button>
        ))}
      </div>
      <div className="list-block">
        {visibleItems.map(item => {
          const imageSrc = imageFromEvidence(item)

          return item.kind === 'reveal' && imageSrc ? (
            <div
              key={item.id}
              className={[
                'evidence-reveal-hero',
                currentAct !== undefined && item.act === currentAct ? 'evidence-reveal-hero--new' : '',
                onItemClick ? 'is-clickable' : '',
              ].filter(Boolean).join(' ')}
              data-testid="evidence-item"
              data-kind={item.kind}
              role={onItemClick ? 'button' : undefined}
              tabIndex={onItemClick ? 0 : undefined}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
              onKeyDown={onItemClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') onItemClick(item)
              } : undefined}
            >
              <Media
                kind="image"
                src={imageSrc}
                alt={item.title}
                ratio="16:9"
                variant="hero"
                fit="cover"
                priority={false}
                sizes="100vw"
                role="decorative"
                fallback={{ type: 'gradient' }}
              />
              <div className="evidence-reveal-hero__overlay">
                <div className="evidence-reveal-hero__badge">Reveal</div>
                <div className="evidence-reveal-hero__title">{item.title}</div>
                <div className="evidence-reveal-hero__body">{item.text}</div>
              </div>
            </div>
          ) : (
            <div
              key={item.id}
              className={[
                'list-row',
                imageSrc ? 'list-row--with-thumb' : '',
                item.kind === 'reveal' ? 'list-row--reveal' : '',
                currentAct !== undefined && item.kind === 'reveal' && item.act === currentAct ? 'list-row--reveal-new' : '',
                onItemClick ? 'is-clickable' : '',
              ].filter(Boolean).join(' ')}
              data-testid="evidence-item"
              data-kind={item.kind}
              role={onItemClick ? 'button' : undefined}
              tabIndex={onItemClick ? 0 : undefined}
              onClick={onItemClick ? () => onItemClick(item) : undefined}
              onKeyDown={onItemClick ? (e) => {
                if (e.key === 'Enter' || e.key === ' ') onItemClick(item)
              } : undefined}
            >
              {imageSrc ? (
                <div className="list-row__thumb">
                  <Media
                    kind="image"
                    src={imageSrc}
                    alt={item.title}
                    ratio="1:1"
                    variant="card"
                    fit="cover"
                    priority={false}
                    sizes="(max-width: 768px) 96px, 140px"
                    role="content"
                    fallback={{ type: 'icon', label: 'Evidence' }}
                  />
                </div>
              ) : null}
              <div className="list-row__main">
                <div className="list-row__meta">
                </div>
                <div className="list-row__title">{item.title}</div>
                <div className="list-row__text">
                  <span className="list-row__text-inner">{item.text}</span>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </Panel>
  )
}
