import type { ComposerData, PostKind, RendererHandlers } from '../../data/types'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'

interface Props {
  data: ComposerData
  handlers?: RendererHandlers
}

export function ComposerPanel({ data, handlers }: Props) {
  const postKind = data.postKind ?? 'suspect'
  const needsTarget = postKind === 'suspect' || postKind === 'accuse'
  const needsText = postKind === 'alibi' || postKind === 'solved'
  const needsEvidencePicker = postKind === 'share_clue'
  const needsLocationPicker = postKind === 'searched'

  const placeholder =
    postKind === 'alibi' ? 'Your alibi (short).'
    : postKind === 'share_clue' ? 'Optional note…'
    : postKind === 'searched' ? 'Optional note…'
    : postKind === 'solved' ? 'What did you solve? (short)'
    : 'Optional note…'

  return (
    <Panel testId="composer-panel" className="composer-panel" dataUi="ComposerPanel">
      <PanelHeader title="Post to feed" meta="Public" />
      <select
        className="composer-select"
        value={postKind}
        onChange={e => {
          const value = e.target.value
          const next: PostKind =
            value === 'suspect' || value === 'accuse' || value === 'alibi' || value === 'share_clue' || value === 'searched' || value === 'solved'
              ? value
              : 'suspect'
          handlers?.onComposerPostKindChange?.(next)
        }}
      >
        <option value="suspect">Suspect</option>
        <option value="accuse">Accuse</option>
        <option value="alibi">Alibi</option>
        <option value="share_clue">Share clue</option>
        <option value="searched">Searched</option>
        <option value="solved">Solved</option>
      </select>

      {needsTarget ? (
        <select
          className="composer-select"
          value={data.recipientId ?? ''}
          onChange={e => handlers?.onComposerRecipientChange?.(e.target.value)}
        >
          <option value="">{postKind === 'suspect' ? 'Who do you suspect?' : 'Who are you accusing?'}</option>
          {data.recipients.map(r => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      ) : null}

      {needsEvidencePicker && Array.isArray(data.evidenceOptions) ? (
        <select
          className="composer-select"
          value={data.evidenceId ?? ''}
          onChange={e => handlers?.onComposerEvidenceChange?.(e.target.value)}
        >
          <option value="">Which clue/evidence?</option>
          {data.evidenceOptions.map(o => (
            <option key={o.id} value={o.id}>{o.label}</option>
          ))}
        </select>
      ) : null}

      {needsLocationPicker ? (
        <input
          className="composer-select"
          placeholder="Location (e.g., Study)"
          value={data.location ?? ''}
          onChange={e => handlers?.onComposerLocationChange?.(e.target.value)}
        />
      ) : null}

      <textarea
        className="composer-textarea"
        placeholder={placeholder}
        value={data.draft}
        onChange={e => handlers?.onComposerDraftChange?.(e.target.value)}
      />
      <div className="composer-actions">
        <button
          type="button"
          className="action-btn action-btn--secondary"
          data-action="post"
          disabled={!data.canSend || !handlers?.onComposerSend || (needsTarget && !data.recipientId) || (needsText && !data.draft.trim())}
          onClick={() => handlers?.onComposerSend?.()}
        >
          Post
        </button>
      </div>
    </Panel>
  )
}
