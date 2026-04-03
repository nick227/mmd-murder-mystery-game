import type { TabId, ViewMode } from '../../data/types'

export interface AppShellProps {
  mode: ViewMode
  shellSurface: string
  gameState: string
  showTabs: boolean
  activeTab: TabId
  children: React.ReactNode
}

export function AppShell(props: AppShellProps) {
  const { mode, shellSurface, gameState, showTabs, activeTab, children } = props

  return (
    <div
      className="app-shell"
      data-testid={`mode-${mode}`}
      data-surface={shellSurface}
      data-game-state={gameState}
      {...(showTabs ? { 'data-tab': activeTab } : {})}
    >
      {children}
    </div>
  )
}
