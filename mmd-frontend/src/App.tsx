import { useEffect, useMemo, useRef } from 'react'
import { BottomNav } from './components/BottomNav'
import { PageRenderer } from './components/PageRenderer'
import { LobbySurface } from './components/surfaces/LobbySurface'
import { GameSurface } from './components/surfaces/GameSurface'
import { ProfileSurface } from './components/surfaces/ProfileSurface'
import { CaseboardSurface } from './components/surfaces/CaseboardSurface'
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
  const [activeTab, setActiveTab] = useTabState('game')

  const launcher = useLauncherState()
  const player = usePlayerScreenData(apiBase, gameId, characterId)
  const host = useHostScreenData(apiBase, gameId, hostKey)
  const pins = usePinnedIds({ gameId, characterId })

  const state = mode === 'host' ? host : mode === 'player' ? player : launcher
  const schema =
    mode === 'host'
      ? hostPageSchema
      : mode === 'player'
      ? (player.joined ? playerPageSchema : joinPageSchema)
      : launcherPageSchema

  const showTabs = Boolean(schema.tabs && (mode === 'player' ? player.joined : mode === 'host'))
  const playerSurfaceDefault = useMemo(() => {
    if (mode !== 'player') return null
    const state = player.screenData.game.state
    return state === 'SCHEDULED' ? 'lobby' : 'game'
  }, [mode, player.screenData.game.state])

  const prevPlayerState = useRef<string | null>(null)
  useEffect(() => {
    if (mode !== 'player' || !player.joined) return
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
      : 'Player live'

  const onReload =
    mode === 'player' ? () => void player.reload()
    : mode === 'host' ? () => void host.reload()
    : undefined

  return (
    <div className="app-shell" data-testid={`mode-${mode}`}>
      <header className="app-header">
        <div>
          <div className="app-header__eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
        </div>
        <div className="app-header__actions">
          {onReload ? <button data-testid="reload" onClick={onReload}>Reload</button> : null}
          <span className="status-dot">{statusLabel}</span>
        </div>
      </header>

      {mode === 'player' && player.joined ? (
        activeTab === 'lobby' ? (
          <LobbySurface data={player.screenData} handlers={player.handlers} />
        ) : activeTab === 'caseboard' ? (
          <CaseboardSurface
            data={player.screenData}
            pinnedIds={pins.pinnedIds}
            onOpenSource={() => setActiveTab('game')}
          />
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

      {showTabs && schema.tabs ? (
        <BottomNav tabs={schema.tabs} activeTab={activeTab} onChange={setActiveTab} />
      ) : null}
    </div>
  )
}
