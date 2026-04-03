import { useEffect, useRef, useState } from 'react'
import type { ObjectiveItem, RendererHandlers } from '../../data/types'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'

interface Props {
  items: ObjectiveItem[]
  handlers?: RendererHandlers
}

type CompletedRow = {
  item: ObjectiveItem
  exiting: boolean
}

export function DoNowPanel({ items, handlers }: Props) {
  const [completedById, setCompletedById] = useState<Record<string, CompletedRow>>({})
  const [submittingById, setSubmittingById] = useState<Record<string, boolean>>({})
  const completionTimersRef = useRef<Record<string, number>>({})
  const removalTimersRef = useRef<Record<string, number>>({})

  useEffect(() => () => {
    for (const timerId of Object.values(completionTimersRef.current)) {
      window.clearTimeout(timerId)
    }
    for (const timerId of Object.values(removalTimersRef.current)) {
      window.clearTimeout(timerId)
    }
  }, [])

  const visible = [
    ...items.filter(i => !i.completed && !completedById[i.id]),
    ...Object.values(completedById).map(entry => ({
      ...entry.item,
      completed: true,
      exiting: entry.exiting,
    })),
  ].slice(0, 3)
  if (!visible.length) return null

  return (
    <Panel testId="do-now-panel">
      <PanelHeader title="Objectives" />
      <div className="list-block">
        {visible.map(item => (
          <div
            key={item.id}
            className={[
              'list-row',
              item.completed ? 'list-row--completed' : '',
              'exiting' in item && item.exiting ? 'list-row--exiting' : '',
            ].filter(Boolean).join(' ')}
            data-intent={String(item.intent ?? '')}
            data-testid="do-now-item"
          >
            <div className="list-row__main">
              <div className="list-row__text">
                <span className="list-row__text-inner">{item.text}</span>
              </div>
            </div>
            <div className="list-row__action">
              {item.completed ? <div className="badge badge--submitted">Submitted</div> : null}
              <button
                type="button"
                disabled={Boolean(submittingById[item.id]) || item.completed}
                className={item.completed ? 'check-button check-button--checked' : 'check-button'}
                data-testid={`objective-toggle:${item.id}`}
                onClick={async () => {
                  const submit = handlers?.onObjectiveSubmit
                  if (!submit) return
                  if (item.completed) return

                  setSubmittingById(current => ({ ...current, [item.id]: true }))
                  setCompletedById(current => ({
                    ...current,
                    [item.id]: { item: { ...item, completed: true }, exiting: false },
                  }))

                  completionTimersRef.current[item.id] = window.setTimeout(() => {
                    setCompletedById(current => current[item.id]
                      ? {
                        ...current,
                        [item.id]: { ...current[item.id], exiting: true },
                      }
                      : current)
                  }, 2000)

                  removalTimersRef.current[item.id] = window.setTimeout(() => {
                    setCompletedById(current => {
                      if (!current[item.id]) return current
                      const next = { ...current }
                      delete next[item.id]
                      return next
                    })
                  }, 2400)

                  try {
                    await submit(item.id)
                  } catch {
                    window.clearTimeout(completionTimersRef.current[item.id])
                    window.clearTimeout(removalTimersRef.current[item.id])
                    delete completionTimersRef.current[item.id]
                    delete removalTimersRef.current[item.id]
                    setCompletedById(current => {
                      if (!current[item.id]) return current
                      const next = { ...current }
                      delete next[item.id]
                      return next
                    })
                  } finally {
                    setSubmittingById(current => ({ ...current, [item.id]: false }))
                  }
                }}
              >
                {submittingById[item.id] ? 'Submitting...' : item.completed ? 'Submitted' : 'Submit'}
              </button>
              <div className="list-row__helper">{item.completed ? 'Posted to the room feed.' : 'Posts to the room feed.'}</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}
