import type { ObjectiveItem, RendererHandlers } from '../../data/types'
import { doNowIntentLabel } from '../../utils/uiText'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'

interface Props {
  items: ObjectiveItem[]
  handlers?: RendererHandlers
}

export function DoNowPanel({ items, handlers }: Props) {
  const visible = items.filter(i => !i.completed).slice(0, 3)
  if (!visible.length) return null

  return (
    <Panel testId="do-now-panel">
      <PanelHeader title="Do this now" meta="Top priorities" />
      <div className="list-block">
        {visible.map(item => (
          <div key={item.id} className="list-row" data-intent={String(item.intent ?? '')} data-testid="do-now-item">
            <div className="list-row__main">
              {item.intent ? (
                <div className="list-row__meta">
                  <span className={`badge badge--intent badge--intent-${item.intent}`}>{doNowIntentLabel(item.intent)}</span>
                </div>
              ) : null}
              <div className="list-row__text">
                <span className="list-row__text-inner">{item.text}</span>
              </div>
            </div>
            <div className="list-row__action">
              <button
                type="button"
                className="check-button"
                data-testid={`objective-toggle:${item.id}`}
                onClick={() => void handlers?.onObjectiveSubmit?.(item.id)}
              >
                Submit
              </button>
              <div className="list-row__helper">Posts to the room feed.</div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

