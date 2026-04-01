import type { LauncherData, RendererHandlers } from '../../../data/types'
import { BottomSheet } from '../../ui/BottomSheet'

type Game = {
  id: string
  name?: string
  apiBase: string
  access?: {
    hostKey?: string
    characterIds?: string[]
  }
}

type Props = {
  game?: Game
  createdGame?: NonNullable<LauncherData['createdGame']>
  apiBase: string
  setupScheduledTime: string
  setupCharacterId: string | null
  onScheduledTimeChange: (v: string) => void
  onCharacterIdChange: (v: string) => void
  onClose: () => void
  handlers?: RendererHandlers
}

function PlayerLinks({ game, apiBase, handlers }: { game: Game; apiBase: string; handlers?: RendererHandlers }) {
  if (!game.access?.characterIds?.length) return null

  return (
    <div className="link-list u-mt-12">
      <div className="field__label">Player links</div>
      {game.access.characterIds.map(characterId => {
        const url = `${window.location.origin}/play/${game.id}/${characterId}${game.apiBase && game.apiBase !== apiBase ? `?api=${encodeURIComponent(game.apiBase)}` : ''}`
        return (
          <div key={characterId} className="link-row">
            <strong>{`Player ${characterId}`}</strong>
            <code>{url}</code>
            <div className="link-row__actions">
              <button
                type="button"
                className="mini-btn"
                onClick={() => handlers?.onCopyText?.(url)}
              >
                Copy link
              </button>
              <button
                type="button"
                className="mini-btn"
                onClick={() => (window.location.href = url)}
              >
                Open
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function HostSetupSheet({
  game,
  createdGame,
  apiBase,
  setupScheduledTime,
  setupCharacterId,
  onScheduledTimeChange,
  onCharacterIdChange,
  onClose,
  handlers,
}: Props) {
  const created = createdGame
  const currentGame = game || (createdGame ? {
    id: createdGame.id,
    name: createdGame.name,
    apiBase,
    access: {
      hostKey: createdGame.hostKey,
      characterIds: createdGame.playerLinks.map(link => link.characterId),
    }
  } : undefined)

  const playerLinks = created?.playerLinks || []

  return (
    <BottomSheet
      open={true}
      onClose={onClose}
      eyebrow="Host setup"
      title={currentGame ? `Game: ${currentGame.name || currentGame.id}` : "Enter the room"}
      meta={currentGame ? "Manage game and players" : "Pick who you're playing and when to start"}
    >
      {created && (
        <>
          <div className="field-grid">
            <div className="field">
              <label className="field__label">Scheduled time</label>
              <input
                className="field__input"
                type="datetime-local"
                value={setupScheduledTime}
                onChange={e => onScheduledTimeChange(e.target.value)}
              />
            </div>
          </div>

          <div className="story-picker u-mt-12">
            <div className="field__label">Play as</div>
            {playerLinks.map(link => (
              <button
                key={link.characterId}
                type="button"
                className={setupCharacterId === link.characterId ? 'story-option story-option--active' : 'story-option'}
                onClick={() => onCharacterIdChange(link.characterId)}
              >
                <strong>{link.label}</strong>
                <span>{link.characterId}</span>
              </button>
            ))}
          </div>

          <div className="launcher-actions u-mt-12">
            <button
              type="button"
              className="action-btn action-btn--primary"
              data-action="join"
              onClick={async () => {
                const gameId = created.id
                const hostKey = created.hostKey
                const characterId = setupCharacterId ?? playerLinks[0]!.characterId
                const scheduledIso = new Date(setupScheduledTime).toISOString()
                await handlers?.onRescheduleGame?.(gameId, hostKey, scheduledIso)
                const query = new URLSearchParams()
                query.set('hostKey', hostKey)
                if (apiBase) query.set('api', apiBase)
                window.location.href = `/room/${gameId}/${characterId}?${query.toString()}`
              }}
            >
              Enter room
            </button>
          </div>
        </>
      )}

      {currentGame && <PlayerLinks game={currentGame} apiBase={apiBase} handlers={handlers} />}
    </BottomSheet>
  )
}
