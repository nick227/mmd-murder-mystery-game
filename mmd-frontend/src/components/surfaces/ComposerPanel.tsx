import type { ComposerData, RendererHandlers } from '../../data/types'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'

interface Props {
  data: ComposerData
  handlers?: RendererHandlers
}

export function ComposerPanel({ data, handlers }: Props) {
  return (
    <Panel testId="composer-panel" className="composer-panel" dataUi="ComposerPanel">
      <PanelHeader title="Post to feed" />
      <textarea
        className="composer-textarea"
        placeholder={data.placeholder ?? ''}
        value={data.draft}
        onChange={e => handlers?.onComposerDraftChange?.(e.target.value)}
      />
      <div className="composer-actions">
        <button
          type="button"
          className="action-btn action-btn--secondary"
          data-action="post"
          disabled={!data.canSend || !handlers?.onComposerSend}
          onClick={() => handlers?.onComposerSend?.(data.draft)}
        >
          Post
        </button>
      </div>
    </Panel>
  )
}
