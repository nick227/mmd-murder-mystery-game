import { useEffect, useMemo, useRef, useState } from 'react'
import { BottomNav } from './components/BottomNav'
import { PageRenderer } from './components/PageRenderer'
import { BottomSheet } from './components/ui/BottomSheet'
import { RenderNode } from './components/Primitives'
import { LobbySurface } from './components/surfaces/LobbySurface'
import { GameSurface } from './components/surfaces/GameSurface'
import { ProfileSurface } from './components/surfaces/ProfileSurface'
import {
  useHostScreenData,
  useLauncherState,
  usePinnedIds,
  usePlayerScreenData,
  useTabState,
  useViewMode,
} from './hooks/useAppState'
import {
  hostPageSchema,
  joinPageSchema,
  launcherPageSchema,
  playerPageSchema,
} from './schemas/pages'
import './styles/app.css'

export default function App() {
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

  const schema =
    mode === 'host'
      ? hostPageSchema
      : mode === 'room'
      ? playerPageSchema
      : launcherPageSchema

  const showTabs =
    mode === 'room'
      ? true
      : Boolean(schema.tabs && mode === 'host')

  const tabs =
    mode === 'room'
      ? (hostKey
          ? [...(playerPageSchema.tabs ?? []), { id: 'host' as const, label: 'Host' }]
          : (playerPageSchema.tabs ?? []))
      : (schema.tabs ?? [])
  const playerSurfaceDefault = useMemo(() => {
    if (mode !== 'room') return null
    const state = player.screenData.game.state
    return state === 'SCHEDULED' ? 'lobby' : 'game'
  }, [mode, player.screenData.game.state])

  const prevPlayerState = useRef<string | null>(null)
  useEffect(() => {
    if (mode !== 'room' || !player.joined) return
    const current = player.screenData.game.state
    if (prevPlayerState.current !== current) {
      prevPlayerState.current = current
      if (playerSurfaceDefault) setActiveTab(playerSurfaceDefault)
    }
  }, [mode, player.joined, player.screenData.game.state, playerSurfaceDefault, setActiveTab])

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

  return (
    <div className="app-shell" data-testid={`mode-${mode}`}>
      <header className="app-header">
        <div>
          <div className="app-header__eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
        </div>
        <div className="app-header__actions">
          {mode === 'host' || (mode === 'room' && hostKey) ? (
            <button type="button" onClick={() => setShowInviteLinks(v => !v)}>
              Links
            </button>
          ) : null}
          {onReload ? <button data-testid="reload" onClick={onReload}>Reload</button> : null}
          <span className="status-dot">{statusLabel}</span>
        </div>
      </header>

      {mode === 'room' ? (
        activeTab === 'host' ? (
          <PageRenderer schema={hostPageSchema} data={host.screenData} handlers={host.handlers} />
        ) : !player.joined ? (
          activeTab === 'lobby' ? (
            <>
              <PageRenderer schema={joinPageSchema} data={player.screenData} handlers={player.handlers} />
              <LobbySurface data={player.screenData} handlers={player.handlers} />
            </>
          ) : (
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
        ) : activeTab === 'lobby' ? (
          <LobbySurface data={player.screenData} handlers={player.handlers} />
        ) : activeTab === 'profile' ? (
          <ProfileSurface data={player.screenData} />
        ) : (
          <GameSurface data={player.screenData} handlers={player.handlers} pins={pins} />
        )
      ) : (
        <PageRenderer
          schema={schema}
          data={state.screenData}
          activeTab={showTabs ? activeTab : undefined}
          handlers={state.handlers}
        />
      )}

      {showTabs && tabs.length ? (
        <BottomNav tabs={tabs} activeTab={activeTab} onChange={setActiveTab} />
      ) : null}

      {(mode === 'host' || mode === 'room') && showInviteLinks && host.screenData.hostInfo ? (
        <BottomSheet
          open={true}
          onClose={() => setShowInviteLinks(false)}
          eyebrow="Host only"
          title="Invite links"
          meta={`Game ${host.screenData.hostInfo.gameId}`}
        >
          <RenderNode
            node={{ id: 'invite-links', type: 'host-info', bind: 'hostInfo' }}
            data={host.screenData}
            handlers={host.handlers}
          />
        </BottomSheet>
      ) : null}
    </div>
  )
}
