import type { ActionItem, RendererHandlers } from '../../data/types'
import { actionVerb } from '../../utils/uiMarkers'

export function ActionsBar({ items, handlers }: { items: ActionItem[]; handlers?: RendererHandlers }) {
  if (!items.length) return null
  return (
    <div className="actions-bar" data-testid="actions-bar">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          disabled={item.disabled}
          className={`action-btn action-btn--${item.kind ?? 'secondary'}`}
          data-testid={`action:${item.id}`}
          data-action={actionVerb(item.id)}
          onClick={() => handlers?.onAction?.(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}
