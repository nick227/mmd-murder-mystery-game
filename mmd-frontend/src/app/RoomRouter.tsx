import type { TabId } from '../data/types'
import { PageRenderer } from '../components/PageRenderer'
import { GameSurface } from '../components/surfaces/GameSurface'
import { LobbySurface } from '../components/surfaces/LobbySurface'
import { ProfileSurface } from '../components/surfaces/ProfileSurface'
import { joinPageSchema } from '../schemas/pages'
import { useRoomContext } from './roomContext'

/** Room layout; reads player + host wiring from `RoomProvider`. */
export function RoomRouter({ activeTab }: { activeTab: TabId }) {
  const room = useRoomContext()
  if (!room) {
    throw new Error('RoomRouter must be used under RoomProvider with a non-null value')
  }

  const {
    joined,
    screenData,
    handlers,
    pins,
    hostHandlers,
    hostError,
    hostLobbyActions,
    hostGameActions,
  } = room

  if (!joined) {
    if (activeTab === 'lobby') {
      return (
        <>
          <PageRenderer schema={joinPageSchema} data={screenData} handlers={handlers} />
          <LobbySurface
            data={screenData}
            handlers={handlers}
            hostActions={hostLobbyActions}
            hostHandlers={hostHandlers}
            hostError={hostError}
          />
        </>
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
      pins={pins}
      hostActions={hostGameActions}
      hostHandlers={hostHandlers}
      hostError={hostError}
    />
  )
}
