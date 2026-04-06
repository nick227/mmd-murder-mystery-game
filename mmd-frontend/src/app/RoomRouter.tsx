import type { TabId } from '../data/types'
import { GameSurface } from '../components/surfaces/GameSurface'
import { LobbySurface } from '../components/surfaces/LobbySurface'
import { useRoomContext } from './roomContext'
import { useAuth } from '../hooks/useAuth'

/** Room layout; reads player + host wiring from `RoomProvider`. */
export function RoomRouter({ activeTab }: { activeTab: TabId }) {
  const room = useRoomContext()
  const { user, login } = useAuth()
  
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
            <h2>Game</h2>
            <div className="panel__meta">Join first</div>
          </div>
          {!user ? (
            <div className="empty-state">
              <div style={{ marginBottom: '1rem' }}>Please sign in to join the game.</div>
              <button 
                type="button"
                className="action-btn action-btn--primary"
                onClick={() => login()}
                style={{ 
                  backgroundColor: 'var(--google-blue, #4285f4)',
                  color: 'white',
                  height: '48px',
                  padding: '0 2rem'
                }}
              >
                Sign in with Google
              </button>
              <div style={{ textAlign: 'center', margin: '1rem 0', color: 'var(--text-secondary)' }}>
                OR
              </div>
              <div>Enter your name in the Lobby tab to join as a guest.</div>
            </div>
          ) : (
            <div className="empty-state">Enter your name in Lobby to join.</div>
          )}
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

  return <GameSurface />
}
