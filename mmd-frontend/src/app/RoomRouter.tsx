import type { TabId } from '../data/types'
import { GameSurface } from '../components/surfaces/GameSurface'
import { LobbySurface } from '../components/surfaces/LobbySurface'
import { ProfileSurface } from '../components/surfaces/ProfileSurface'
import { useRoomContext } from './roomContext'

/** Room layout; reads player + host wiring from `RoomProvider`. */
export function RoomRouter({ activeTab }: { activeTab: TabId }) {
  const room = useRoomContext()
  if (!room) {
    throw new Error('RoomRouter must be used under RoomProvider with a non-null value')
  }

  const {
    joined,
    currentCharacterId,
    screenData,
    handlers,
    hostHandlers,
    hostError,
    hostLobbyActions,
  } = room

  if (!joined) {
    if (activeTab === 'lobby') {
      return (
        <LobbySurface
          data={screenData}
          handlers={handlers}
          joined={joined}
          currentCharacterId={currentCharacterId}
          hostActions={hostLobbyActions}
          hostHandlers={hostHandlers}
          hostError={hostError}
        />
      )
    }
    return (
      <main className="screen-stack">
        <section className="panel">
          <div className="panel__header">
            <h2>{activeTab === 'game' ? 'Game' : 'Profile'}</h2>
            <div className="panel__meta">Join first</div>
          </div>
          <div className="empty-state">Enter your name in Lobby to join.</div>
        </section>
      </main>
    )
  }

  if (activeTab === 'lobby') {
    return (
      <LobbySurface
        data={screenData}
        handlers={handlers}
        joined={joined}
        currentCharacterId={currentCharacterId}
        hostActions={hostLobbyActions}
        hostHandlers={hostHandlers}
        hostError={hostError}
      />
    )
  }

  if (activeTab === 'profile') {
    return <ProfileSurface data={screenData} />
  }

  return (
    <GameSurface
      data={screenData}
      handlers={handlers}
    />
  )
}
