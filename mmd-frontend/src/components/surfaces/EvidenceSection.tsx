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

export function EvidenceSection({ items, title = 'Evidence this act', currentAct, onItemClick }: Props) {
  if (!items.length) return null

  const ordered = sortEvidence(items)

  return (
    <Panel testId="evidence-section">
      <PanelHeader title={title} meta="Read-only" />
      <div className="list-block">
        {ordered.map(item => (
          item.kind === 'reveal' && item.image ? (
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
                src={item.image}
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
              <div className="list-row__main">
                <div className="list-row__meta">
                  <span className={`badge badge--intent badge--intent-${item.kind}`}>{evidenceKindLabel(item.kind)}</span>
                </div>
                {item.image ? (
                  <div style={{ marginTop: 8, marginBottom: 8 }}>
                    <Media
                      kind="image"
                      src={item.image}
                      alt={item.title}
                      ratio="auto"
                      variant="card"
                      fit="contain"
                      priority={false}
                      sizes="(max-width: 768px) 100vw, 480px"
                      role="content"
                      fallback={{ type: 'icon', label: 'Evidence' }}
                    />
                  </div>
                ) : null}
                <div className="list-row__title">{item.title}</div>
                <div className="list-row__text">
                  <span className="list-row__text-inner">{item.text}</span>
                </div>
              </div>
            </div>
          )
        ))}
      </div>
    </Panel>
  )
}

