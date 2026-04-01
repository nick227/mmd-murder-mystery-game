import { useEffect, useMemo, useState } from 'react'
import {
  useHostScreenData,
  useLauncherState,
  usePinnedIds,
  usePlayerScreenData,
  useTabState,
  useViewMode,
} from '../hooks/useAppState'
import { playerPageSchema } from '../schemas/pages'
import { selectPageSchema } from '../schemas/selectPageSchema'
import { deriveAppShellSurface } from './deriveAppShellSurface'
import { AppView } from './AppView'
import { RoomProvider, type RoomContextValue } from './roomContext'
import { useRoomTabSync } from './useRoomTabSync'

export function AppController() {
  const { mode, apiBase, gameId, characterId, hostKey } = useViewMode()
  const [activeTab, setActiveTab] = useTabState(mode === 'room' ? 'lobby' : 'game')
  const [showInviteLinks, setShowInviteLinks] = useState(false)

  const launcher = useLauncherState()
  const player = usePlayerScreenData(apiBase, gameId, characterId)
  const host = useHostScreenData(apiBase, gameId, hostKey)
  const pins = usePinnedIds({ gameId, characterId })

  const state =
    mode === 'host' ? host
    : mode === 'room' ? player
    : launcher

  const schema = selectPageSchema(mode)

  const showTabs =
    mode === 'room'
      ? true
      : Boolean(schema.tabs && mode === 'host')

  const tabs = mode === 'room' ? (playerPageSchema.tabs ?? []) : (schema.tabs ?? [])
  const playerSurfaceDefault = useMemo(() => {
    if (mode !== 'room') return null
    const g = player.screenData.game.state
    return g === 'SCHEDULED' ? 'lobby' : 'game'
  }, [mode, player.screenData.game.state])

  const hostRoomGameControls = Boolean(hostKey) && player.screenData.game.state !== 'SCHEDULED'

  useRoomTabSync({
    mode,
    joined: player.joined,
    gameState: player.screenData.game.state,
    targetTab: playerSurfaceDefault,
    setActiveTab,
  })

  const title =
    mode === 'launcher'
      ? 'Murder Mystery Dinner'
      : state.screenData.game.subtitle || 'Game room'

  const eyebrow =
    mode === 'launcher'
      ? 'Main menu'
      : mode === 'host'
      ? 'Host control room'
      : mode === 'room' && hostKey
      ? 'Room · Host'
      : `In game · ${state.screenData.profile.characterName || 'Joining character'}`

  const statusLabel =
    state.loading
      ? 'Loading…'
      : state.error
      ? `Error: ${state.error}`
      : mode === 'launcher'
      ? 'Ready'
      : mode === 'host'
      ? 'Host live'
      : mode === 'room' && hostKey
      ? 'Host live'
      : 'Player live'

  const onReload =
    mode === 'room' ? () => void player.reload()
    : mode === 'host' ? () => void host.reload()
    : undefined

  useEffect(() => {
    if (mode !== 'host' && mode !== 'room') setShowInviteLinks(false)
  }, [mode])

  useEffect(() => {
    document.body.dataset.mode = mode
    return () => {
      delete document.body.dataset.mode
    }
  }, [mode])

  const shellSurface = useMemo(
    () => deriveAppShellSurface(mode, player.joined, activeTab),
    [mode, player.joined, activeTab],
  )

  const hostLobbyActions = hostKey ? host.screenData.gameActions : undefined

  const roomValue: RoomContextValue | null =
    mode === 'room'
      ? {
          joined: player.joined,
          screenData: player.screenData,
          handlers: player.handlers,
          pins,
          hostHandlers: hostKey ? host.handlers : undefined,
          hostError: hostKey ? host.error : undefined,
          hostLobbyActions,
          hostGameActions: hostRoomGameControls ? host.screenData.gameActions : undefined,
        }
      : null

  const inviteOpen =
    (mode === 'host' || mode === 'room') && showInviteLinks && host.screenData.hostInfo

  const view = (
    <AppView
      mode={mode}
      title={title}
      eyebrow={eyebrow}
      statusLabel={statusLabel}
      onReload={onReload}
      showInviteButton={mode === 'host' || (mode === 'room' && Boolean(hostKey))}
      onToggleInvite={() => setShowInviteLinks(v => !v)}
      shellSurface={shellSurface}
      gameState={state.screenData.game.state}
      showTabs={showTabs}
      activeTab={activeTab}
      onTabChange={setActiveTab}
      tabs={tabs}
      schema={schema}
      pageData={state.screenData}
      pageHandlers={state.handlers}
      pageRendererActiveTab={showTabs ? activeTab : undefined}
      inviteSheet={
        inviteOpen && host.screenData.hostInfo
          ? {
              gameId: host.screenData.hostInfo.gameId,
              screenData: host.screenData,
              handlers: host.handlers,
              onClose: () => setShowInviteLinks(false),
            }
          : null
      }
    />
  )

  return <RoomProvider value={roomValue}>{view}</RoomProvider>
}
