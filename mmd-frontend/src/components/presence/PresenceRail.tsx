import type { RoomPlayer } from '../../data/types'
import { Avatar } from './Avatar'

interface Props {
  players: RoomPlayer[]
  size?: 'compact' | 'large'
  title?: string
}

export function PresenceRail({ players, size = 'compact', title = 'In the room' }: Props) {
  if (!players.length) return null

  return (
    <section className="panel presence-rail" data-size={size} aria-label={title}>
      <div className="panel__header">
        <h2>{title}</h2>
        <div className="panel__meta">{players.filter(p => p.online).length}/{players.length} online</div>
      </div>
      <div className="presence-rail__scroll" data-testid="presence-rail">
        {players.map(player => (
          <div key={player.id} className="presence-tile" data-online={player.online ? 'true' : 'false'}>
            <Avatar name={player.name} online={player.online} size={size === 'large' ? 'lg' : 'md'} src={player.portrait} />
            <div className="presence-tile__text">
              <div className="presence-tile__name">{player.name}</div>
              <div className="presence-tile__meta">{player.online ? 'here' : 'not joined'}</div>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

