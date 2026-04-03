import type { RoomPlayer } from '../../data/types'
import { Avatar } from '../presence/Avatar'

/** Renders pill items only; caller wraps with a semantic row (e.g. `player-pills`). */
export function Pills({ players, type = 'row' }: { players: RoomPlayer[]; type?: string }) {
  if (!players.length) return null
  return (
    <>
      {players.map((player, index) => (
        <div
          key={player.id}
          className={player.online ? 'pill pill--online' : 'pill'}
          data-testid={`player-pill-${player.characterId}`}
        >
          <div className={`${type === 'row' ? 'pill__row' : 'pill__column'}`}>
            <Avatar name={player.name} online={player.online} size="sm" src={player.portrait} />
            <div className="pill__text">
              <span className="pill__name truncate">{player.name}</span>
              <span className="pill__meta">{player.online ? 'in room' : 'not joined'}</span>
            </div>
          </div>
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
