import type { RoomPlayer } from '../../data/types'

/** Renders pill items only; caller wraps with a semantic row (e.g. `player-pills`). */
export function Pills({ players }: { players: RoomPlayer[] }) {
  if (!players.length) return null
  return (
    <>
      {players.map((player, index) => (
        <div
          key={player.id}
          className={player.online ? 'pill pill--online' : 'pill'}
          data-testid={`player-pill-${player.characterId}`}
        >
          <span className="pill__name">{player.name}</span>
          <span className="pill__meta">{player.online ? 'in room' : 'not joined'}</span>
          <span
            data-testid={`player-pill-${index}`}
            className="u-sr-only"
          >
            {player.characterId}
          </span>
          {player.online ? (
            <span data-testid={`player-pill-joined-${index}`} className="u-sr-only">
              joined
            </span>
          ) : null}
          {player.online ? (
            <span data-testid={`player-pill-joined-${player.characterId}`} className="u-sr-only">
              joined
            </span>
          ) : null}
        </div>
      ))}
    </>
  )
}
