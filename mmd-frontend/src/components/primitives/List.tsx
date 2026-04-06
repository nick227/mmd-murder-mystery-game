import { useMemo, useState } from 'react'
import type {
  ObjectiveItem,
  ProfileCardItem,
  RendererHandlers,
} from '../../data/types'
import { intentBadgeLabel } from '../../utils/uiText'

const INTENT_RANK: Record<string, number> = {
  reveal: 0,
  puzzle: 1,
  clue: 2,
  instruction: 3,
  info: 4,
  '': 5,
}

export function List({
  items,
  emptyText,
  handlers,
  className,
}: {
  items: ObjectiveItem[] | ProfileCardItem[]
  emptyText?: string
  handlers?: RendererHandlers
  /** Call-site semantic wrapper, e.g. `objectives-list` from layout node id. */
  className?: string
}) {
  if (!items.length) return <div className="empty-state">{emptyText ?? 'Nothing here yet.'}</div>

  const textsById = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of items) {
      const raw = 'value' in item ? item.value : item.text
      map.set(item.id, String(raw ?? ''))
    }
    return map
  }, [items])

  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({})
  const [submittingById, setSubmittingById] = useState<Record<string, boolean>>({})
  const [flashById, setFlashById] = useState<Record<string, boolean>>({})

  const isObjectiveList = items.every(item => 'completed' in item)
  const objectiveItems = (isObjectiveList ? (items as ObjectiveItem[]) : [])

  const isInstructionObjectives =
    isObjectiveList
    && objectiveItems.length > 0
    && objectiveItems.every(i => !i.group)
    && objectiveItems.some(i => i.intent === 'instruction' || !i.intent)

  const orderedItems: Array<ObjectiveItem | ProfileCardItem> = useMemo(() => {
    if (!isObjectiveList) return items
    const objs = items as ObjectiveItem[]
    const hasGroup = objs.some(i => Boolean(i.group))
    if (!hasGroup) return items
    const cloned = [...objs]
    cloned.sort((a, b) => (INTENT_RANK[String(a.intent ?? '')] ?? 99) - (INTENT_RANK[String(b.intent ?? '')] ?? 99))
    return cloned
  }, [items, isObjectiveList])

  const renderRows = (rows: Array<ObjectiveItem | ProfileCardItem>) => (
    <>
      {rows.map(item => {
        const isObjective = 'completed' in item
        const text = textsById.get(item.id) ?? ''
        const isLong = text.length > 220 || text.split('\n').length > 4
        const expanded = Boolean(expandedById[item.id])
        const submitting = Boolean(submittingById[item.id])
        const intent = isObjective && 'intent' in item ? String(item.intent ?? '') : ''
        const isReveal = isObjective && intent === 'reveal'

        return (
          <div
            key={item.id}
            className={[
              'list-col',
              isObjective && item.completed ? 'list-row--complete' : '',
              flashById[item.id] ? 'list-row--flash' : '',
            ].filter(Boolean).join(' ')}
            data-testid={isObjective ? 'card' : undefined}
            data-intent={isObjective ? intent : undefined}
          >
            <div className="list-row__main">
              {'label' in item ? <div className="list-row__title">{item.label}</div> : null}
              {isObjective && intent ? (
                <div className="list-row__meta">
                  <span className={`badge badge--intent badge--intent-${intent}`}>{intentBadgeLabel(intent as ObjectiveItem['intent'])}</span>
                </div>
              ) : null}
              <div className={expanded ? 'list-row__text list-row__text--expanded' : 'list-row__text'}>
                <span className="list-row__text-inner">{text}</span>
              </div>
              {isLong ? (
                <button
                  type="button"
                  className="mini-btn list-row__more"
                  onClick={() => setExpandedById(current => ({ ...current, [item.id]: !expanded }))}
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              ) : null}
            </div>
            {isObjective ? (
              <div className="list-row__action">
                {isReveal ? <div className="badge badge--new">New</div> : null}
                <button
                  type="button"
                  disabled={submitting}
                  className={item.completed ? 'check-button check-button--checked' : 'check-button'}
                  data-testid={`objective-toggle:${item.id}`}
                  onClick={async () => {
                    const submit = handlers?.onObjectiveSubmit
                    const toggle = handlers?.onObjectiveToggle
                    if (!submit && !toggle) return

                    setSubmittingById(current => ({ ...current, [item.id]: true }))
                    try {
                      if (submit) {
                        await submit(item.id)
                      } else {
                        toggle?.(item.id)
                      }
                      setFlashById(current => ({ ...current, [item.id]: true }))
                      window.setTimeout(() => {
                        setFlashById(current => ({ ...current, [item.id]: false }))
                      }, 650)
                    } finally {
                      setSubmittingById(current => ({ ...current, [item.id]: false }))
                    }
                  }}
                >
                  {submitting ? 'Submitting…' : item.completed ? 'Submitted' : 'Submit'}
                </button>
                <div className="list-row__helper">Posts to the room feed.</div>
              </div>
            ) : null}
          </div>
        )
      })}
    </>
  )

  const rootClass = ['list-block', className].filter(Boolean).join(' ')

  return (
    <div className={rootClass} data-testid="list-block">
      {isInstructionObjectives ? (
        <>
          <div className="list-block__section-title">Do now</div>
          {renderRows(objectiveItems.filter(i => !i.completed))}
          <div className="list-block__section-title">Submitted</div>
          {renderRows(objectiveItems.filter(i => i.completed))}
        </>
      ) : (
        renderRows(orderedItems)
      )}
    </div>
  )
}
