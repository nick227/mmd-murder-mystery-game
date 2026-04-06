import { useEffect, useMemo, useState } from 'react'
import {
  useHostScreenData,
  useLauncherState,
  usePlayerScreenData,
  useTabState,
  useViewMode,
} from '../hooks/useAppState'
import { playerPageSchema } from '../schemas/pages'
import { selectPageSchema } from '../schemas/selectPageSchema'
import { deriveAppShellSurface } from './deriveAppShellSurface'
import { AppView } from './AppView'
import { RoomProvider, type RoomContextValue } from './roomContext'
import { AuthProvider } from '../auth/AuthProvider'

function AppControllerInner() {
  const { mode, apiBase, gameId, characterId, hostKey } = useViewMode()
  const [activeTab, setActiveTab] = useTabState(mode === 'room' ? 'lobby' : 'game')
  const [showInviteLinks, setShowInviteLinks] = useState(false)

  const launcher = useLauncherState()
  const player = usePlayerScreenData(apiBase, gameId, characterId)
  const host = useHostScreenData(apiBase, gameId, hostKey)

  const state =
    mode === 'host' ? host
    : mode === 'room' ? player
    : launcher

  const schema = selectPageSchema(mode)

  const showTabs = mode === 'room' ? false : Boolean(schema.tabs && mode === 'host')

  const tabs = mode === 'room' ? (playerPageSchema.tabs ?? []) : (schema.tabs ?? [])

  const title =
    mode === 'launcher'
      ? 'Murder Mystery Dinner'
      : (() => {
        const gameName = state.screenData.game.subtitle || 'Game room'
        const isScheduled = state.screenData.game.state === 'SCHEDULED'
        const t = state.screenData.game.scheduledTime
        const when = isScheduled && t ? new Date(t).toLocaleString() : ''
        return when ? `${gameName} · ${when}` : gameName
      })()

  const documentTitle =
    mode === 'launcher'
      ? 'Murder Mystery Dinner'
      : (() => {
        const gameName = state.screenData.game.subtitle?.trim() || 'Game room'
        const storyTitle = state.screenData.game.storyTitle?.trim()
        return storyTitle ? `${gameName} | ${storyTitle}` : gameName
      })()

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
      ? 'Issue'
      : 'Connected'

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

  useEffect(() => {
    document.title = documentTitle
  }, [documentTitle])

  const shellSurface = useMemo(
    () => deriveAppShellSurface(mode, player.joined, activeTab),
    [mode, player.joined, activeTab],
  )

  const hostLobbyActions = hostKey ? host.screenData.gameActions : undefined

  // Create enhanced handlers that can handle player-links action
  const enhancedHostHandlers = useMemo(() => {
    if (!host.handlers) return undefined
    return {
      ...host.handlers,
      onAction: async (actionId: string) => {
        if (actionId === 'player-links') {
          setShowInviteLinks(true)
          return
        }
        return host.handlers.onAction?.(actionId)
      },
    }
  }, [host.handlers])

  // Also enhance the main state handlers for host mode
  const enhancedStateHandlers = useMemo(() => {
    if (mode !== 'host' || !state.handlers) return state.handlers
    return {
      ...state.handlers,
      onAction: async (actionId: string) => {
        if (actionId === 'player-links') {
          setShowInviteLinks(true)
          return
        }
        return state.handlers.onAction?.(actionId)
      },
    }
  }, [mode, state.handlers])

  const roomValue: RoomContextValue | null =
    mode === 'room'
        ? {
          joined: player.joined,
          currentCharacterId: characterId,
          screenData: player.screenData,
          handlers: player.handlers,
          hostHandlers: hostKey ? enhancedHostHandlers : undefined,
          hostError: hostKey ? host.error : undefined,
          hostLobbyActions,
        }
      : null

  const inviteOpen =
    (mode === 'host' || mode === 'room') && showInviteLinks && host.screenData.hostInfo

  const contentLoading =
    (mode === 'room' || mode === 'host') && state.loading

  const view = (
    <AppView
      shell={{
        mode,
        shellSurface,
        gameState: state.screenData.game.state,
        showTabs,
        activeTab,
      }}
      header={{
        title,
        eyebrow,
        statusLabel,
      }}
      main={{
        mode,
        activeTab,
        schema,
        pageData: state.screenData,
        pageHandlers: enhancedStateHandlers,
        pageRendererActiveTab: showTabs ? activeTab : undefined,
        contentLoading,
      }}
      tabs={{
        showTabs,
        activeTab,
        onTabChange: setActiveTab,
        tabs,
      }}
      actions={{ onReload }}
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

  return (
    <RoomProvider value={roomValue}>{view}</RoomProvider>
  )
}

export function AppController() {
  return (
    <AuthProvider>
      <AppControllerInner />
    </AuthProvider>
  )
}
