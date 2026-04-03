import type { JoinData, RendererHandlers, ScreenData } from '../../data/types'
import { Card } from './Card'

export function JoinCard({
  join,
  game,
  handlers,
}: {
  join: JoinData
  game: ScreenData['game']
  handlers?: RendererHandlers
}) {
  return (
    <Card title={join.title} className="join-card">
      {join.subtitle ? <p className="profile-card__bio">{join.subtitle}</p> : null}
      {game.state === 'SCHEDULED' && game.banner ? (
        <h2 className="profile-card__bio">{game.banner}</h2>
      ) : null}
      <div className="field-grid u-mt-12">
        <div className="field">
          <input
            className="field__input"
            value={join.playerName}
            placeholder="Enter your real name"
            data-testid="join-name"
            autoFocus
            onChange={e => handlers?.onJoinNameChange?.(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handlers?.onJoinSubmit?.()
            }}
          />
        </div>
      </div>
      <div className="launcher-actions u-mt-12">
        <button
          type="button"
          className="action-btn action-btn--primary join-card__button"
          data-testid="join-submit"
          data-action="join"
          onClick={() => handlers?.onJoinSubmit?.()}
        >
          {join.submitLabel}
        </button>
      </div>
    </Card>
  )
}

