import type { ComposerData, MoveType, RendererHandlers } from '../../data/types'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'

interface Props {
  data: ComposerData
  handlers?: RendererHandlers
}

export function ComposerPanel({ data, handlers }: Props) {
  const moveType = data.moveType ?? 'suspect'
  const needsTarget = moveType === 'suspect' || moveType === 'accuse'
  const needsText = moveType === 'alibi' || moveType === 'solved'
  const needsEvidencePicker = moveType === 'share_clue'
  const needsLocationPicker = moveType === 'searched'

  const placeholder =
    moveType === 'alibi' ? 'Your alibi (short).'
    : moveType === 'share_clue' ? 'Optional note…'
    : moveType === 'searched' ? 'Optional note…'
    : moveType === 'solved' ? 'What did you solve? (short)'
    : 'Optional note…'

  return (
    <Panel testId="composer-panel" className="composer-panel">
      <PanelHeader title="Make a move" meta="Public" />
      <select
        className="composer-select"
        value={moveType}
        onChange={e => {
          const value = e.target.value
          const next: MoveType =
            value === 'suspect' || value === 'accuse' || value === 'alibi' || value === 'share_clue' || value === 'searched' || value === 'solved'
              ? value
              : 'suspect'
          handlers?.onComposerMoveTypeChange?.(next)
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
          <option value="">{moveType === 'suspect' ? 'Who do you suspect?' : 'Who are you accusing?'}</option>
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
          disabled={!data.canSend || !handlers?.onComposerSend || (needsTarget && !data.recipientId) || (needsText && !data.draft.trim())}
          onClick={() => handlers?.onComposerSend?.()}
        >
          Post
        </button>
      </div>
    </Panel>
  )
}

