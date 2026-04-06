import type { JoinData, RendererHandlers, ScreenData } from '../../data/types'
import { Card } from './Card'
import { useAuth } from '../../hooks/useAuth'

export function JoinCard({
  join,
  game,
  handlers,
}: {
  join: JoinData
  game: ScreenData['game']
  handlers?: RendererHandlers
}) {
  const { user, login } = useAuth()
  
  return (
    <Card title={join.title} className="join-card">
      {join.subtitle ? <p className="profile-card__bio">{join.subtitle}</p> : null}
      {game.state === 'SCHEDULED' && game.banner ? (
        <h2 className="profile-card__bio">{game.banner}</h2>
      ) : null}
      
      {!user && (
        <div className="field-grid u-mt-12">
          <div className="field">
            <button
              type="button"
              className="field__input action-btn action-btn--primary"
              style={{ 
                backgroundColor: 'var(--google-blue, #4285f4)',
                color: 'white',
                marginBottom: '1rem',
                height: '48px'
              }}
              onClick={() => login()}
            >
              Sign in with Google to join as your Google account
            </button>
          </div>
          <div style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-secondary)' }}>
            OR
          </div>
        </div>
      )}
      
      <div className="field-grid u-mt-12">
        <div className="field">
          <input
            className="field__input"
            value={join.playerName}
            placeholder={user ? `Playing as ${user.name}` : "Enter your name (or sign in above)"}
            data-testid="join-name"
            autoFocus={!user}
            disabled={!!user}
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
          {user ? `Join as ${user.name}` : join.submitLabel}
        </button>
      </div>
    </Card>
  )
}

