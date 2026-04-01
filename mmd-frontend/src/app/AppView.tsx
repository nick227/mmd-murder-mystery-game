/**
 * App shell: header + main content + bottom nav + sheets.
 * Tree: App → AppController → RoomProvider → AppView → (RoomRouter | PageRenderer) | BottomNav | BottomSheet
 */
import type { PageSchema, RendererHandlers, ScreenData, TabId, ViewMode } from '../data/types'
import { BottomNav } from '../components/BottomNav'
import { PageRenderer } from '../components/PageRenderer'
import { BottomSheet } from '../components/ui/BottomSheet'
import { RenderNode } from '../components/primitives'
import { ui } from '../utils/uiMarkers'
import { RoomRouter } from './RoomRouter'

export interface AppViewProps {
  mode: ViewMode
  title: string
  eyebrow: string
  statusLabel: string
  onReload?: () => void
  showInviteButton: boolean
  onToggleInvite: () => void
  shellSurface: string
  gameState: string
  showTabs: boolean
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  tabs: { id: TabId; label: string }[]
  schema: PageSchema
  pageData: ScreenData
  pageHandlers: RendererHandlers
  pageRendererActiveTab?: TabId
  inviteSheet: null | {
    gameId: string
    screenData: ScreenData
    handlers: RendererHandlers
    onClose: () => void
  }
}

export function AppView(props: AppViewProps) {
  const {
    mode,
    title,
    eyebrow,
    statusLabel,
    onReload,
    showInviteButton,
    onToggleInvite,
    shellSurface,
    gameState,
    showTabs,
    activeTab,
    onTabChange,
    tabs,
    schema,
    pageData,
    pageHandlers,
    pageRendererActiveTab,
    inviteSheet,
  } = props

  return (
    <div
      className="app-shell"
      data-testid={`mode-${mode}`}
      {...ui('App')}
      data-surface={shellSurface}
      data-game-state={gameState}
      {...(showTabs ? { 'data-tab': activeTab } : {})}
    >
      <header className="app-header">
        <div>
          <div className="app-header__eyebrow">{eyebrow}</div>
          <h1>{title}</h1>
        </div>
        <div className="app-header__actions">
          {showInviteButton ? (
            <button type="button" data-action="invite" onClick={onToggleInvite}>
              Links
            </button>
          ) : null}
          {onReload ? <button data-testid="reload" data-action="reload" onClick={onReload}>Reload</button> : null}
          <span className="status-dot">{statusLabel}</span>
        </div>
      </header>

      {mode === 'room' ? (
        <RoomRouter activeTab={activeTab} />
      ) : (
        <PageRenderer
          schema={schema}
          data={pageData}
          activeTab={pageRendererActiveTab}
          handlers={pageHandlers}
        />
      )}

      {showTabs && tabs.length ? (
        <BottomNav tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
      ) : null}

      {inviteSheet ? (
        <BottomSheet
          open={true}
          onClose={inviteSheet.onClose}
          eyebrow="Host only"
          title="Invite links"
          meta={`Game ${inviteSheet.gameId}`}
        >
          <RenderNode
            node={{ id: 'invite-links', type: 'host-info', bind: 'hostInfo' }}
            data={inviteSheet.screenData}
            handlers={inviteSheet.handlers}
          />
        </BottomSheet>
      ) : null}
    </div>
  )
}
