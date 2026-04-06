import { useEffect, useMemo, useRef, useState } from 'react'
import type { ObjectiveItem, RendererHandlers } from '../../data/types'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'
import { Media } from '../ui/Media'

interface Props {
  items: ObjectiveItem[]
  handlers?: RendererHandlers
}

const MIN_CELEBRATION_MS = 3000

export function DoNowPanel({ items, handlers }: Props) {
  const [submittingById, setSubmittingById] = useState<Record<string, boolean>>({})
  const [frozenItems, setFrozenItems] = useState<ObjectiveItem[] | null>(null)

  const timersRef = useRef<Record<string, number>>({})

  // cleanup timers
  useEffect(() => {
    return () => {
      Object.values(timersRef.current).forEach(clearTimeout)
    }
  }, [])

  // unfreeze only when actually frozen + no submissions left
  useEffect(() => {
    if (frozenItems && Object.keys(submittingById).length === 0) {
      setFrozenItems(null)
    }
  }, [submittingById, frozenItems])

  const visible = useMemo(
    () => frozenItems ?? items.slice(0, 3),
    [frozenItems, items]
  )

  if (!visible.length) return null

  return (
    <Panel testId="do-now-panel">
      <PanelHeader title="Objectives" />

      <div className="list-block">
        {visible.map(item => (
          <div
            key={item.id}
            className={[
              'list-col',
              item.completed ? 'list-row--completed' : '',
            ].filter(Boolean).join(' ')}
            data-intent={String(item.intent ?? '')}
            data-testid="do-now-item"
          >
            <div style={{ width: '100%', marginBottom: 10 }}>
              <Media
                alt="Game Card"
                variant="hero"
                ratio="16:9"
                fit="cover"
                fallback={{ type: 'gradient', label: item.intent }}
              />
            </div>

            <div className="list-row__main" style={{ width: '100%', marginBottom: 20 }}>
              <div className="list-row__text">
                <span className="list-row__text-inner">{item.text}</span>
              </div>
            </div>

            <div className="list-row__action" style={{ width: '100%', marginBottom: 10 }}>
              <button
                type="button"
                disabled={Boolean(submittingById[item.id]) || item.completed}
                className={
                  (item.completed || submittingById[item.id])
                    ? 'check-button check-button--checked'
                    : 'check-button'
                }
                data-testid={`objective-toggle:${item.id}`}
                onClick={async () => {
                  const submit = handlers?.onObjectiveSubmit
                  if (!submit || item.completed) return

                  // snapshot once (race safe)
                  setFrozenItems(prev => prev ?? items.slice(0, 3))

                  const start = Date.now()

                  setSubmittingById(s => ({
                    ...s,
                    [item.id]: true
                  }))

                  try {
                    await submit(item.id)

                    const elapsed = Date.now() - start
                    const wait = Math.max(0, MIN_CELEBRATION_MS - elapsed)

                    if (timersRef.current[item.id]) {
                      clearTimeout(timersRef.current[item.id])
                    }

                    timersRef.current[item.id] = window.setTimeout(() => {
                      setSubmittingById(current => {
                        const next = { ...current }
                        delete next[item.id]
                        return next
                      })
                    }, wait)

                  } catch {
                    setSubmittingById(current => {
                      const next = { ...current }
                      delete next[item.id]
                      return next
                    })
                  }
                }}
              >
                {submittingById[item.id]
                  ? '🎉 CONGRATULATIONS!'
                  : item.completed
                    ? 'Completed'
                    : 'Submit'}
              </button>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}