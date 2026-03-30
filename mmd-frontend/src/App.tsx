import { BottomNav } from './components/BottomNav'
import { PageRenderer } from './components/PageRenderer'
import {
  useHostScreenData,
  useLauncherState,
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

  const state = mode === 'host' ? host : mode === 'player' ? player : launcher
  const schema =
    mode === 'host'
      ? hostPageSchema
      : mode === 'player'
      ? (player.joined ? playerPageSchema : joinPageSchema)
      : launcherPageSchema

  const showTabs = Boolean(schema.tabs && (mode === 'player' ? player.joined : mode === 'host'))

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

      <PageRenderer
        schema={schema}
        data={state.screenData}
        activeTab={showTabs ? activeTab : undefined}
        handlers={state.handlers}
      />

      {showTabs && schema.tabs ? (
        <BottomNav tabs={schema.tabs} activeTab={activeTab} onChange={setActiveTab} />
      ) : null}
    </div>
  )
}
