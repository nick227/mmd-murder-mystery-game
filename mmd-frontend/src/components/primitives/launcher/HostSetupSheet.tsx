import type { LauncherData, RendererHandlers } from '../../../data/types'
import { BottomSheet } from '../../ui/BottomSheet'

type Props = {
  createdGame: NonNullable<LauncherData['createdGame']>
  apiBase: string
  setupScheduledTime: string
  setupCharacterId: string | null
  onScheduledTimeChange: (v: string) => void
  onCharacterIdChange: (v: string) => void
  onClose: () => void
  handlers?: RendererHandlers
}

export function HostSetupSheet({
  createdGame,
  apiBase,
  setupScheduledTime,
  setupCharacterId,
  onScheduledTimeChange,
  onCharacterIdChange,
  onClose,
  handlers,
}: Props) {
  return (
    <BottomSheet
      open={true}
      onClose={onClose}
      eyebrow="Host setup"
      title="Enter the room"
      meta="Pick who you’re playing and when to start"
    >
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
        {createdGame.playerLinks.map(link => (
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
            const gameId = createdGame.id
            const hostKey = createdGame.hostKey
            const characterId = setupCharacterId ?? createdGame.playerLinks[0]!.characterId
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
    </BottomSheet>
  )
}
