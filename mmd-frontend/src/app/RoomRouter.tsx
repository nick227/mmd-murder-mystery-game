import { LobbySurface } from '../components/surfaces/LobbySurface'
import { useRoomContext } from './roomContext'

/** Single room view: full lobby (no tab switching). */
export function RoomRouter() {
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
