/**
 * App shell: header + main content + bottom nav + sheets.
 * Tree: App → AppController → RoomProvider → AppView → (RoomRouter | PageRenderer) | BottomNav | BottomSheet
 */
import type { PageSchema, RendererHandlers, ScreenData, TabId, ViewMode } from '../data/types'
import { SiteHeader } from '../components/site/SiteHeader'
import { AppMain } from '../components/app/AppMain'
import { AppShell } from '../components/app/AppShell'
import { AppTabs } from '../components/app/AppTabs'
import { InviteLinksSheet } from '../components/app/InviteLinksSheet'
import { navigateToLauncher } from './inAppNavigation'

export interface AppViewProps {
  shell: {
    mode: ViewMode
    shellSurface: string
    gameState: string
    showTabs: boolean
    activeTab: TabId
  }
  header: {
    title: string
    eyebrow: string
    statusLabel: string
  }
  main: {
    mode: ViewMode
    activeTab: TabId
    schema: PageSchema
    pageData: ScreenData
    pageHandlers: RendererHandlers
    pageRendererActiveTab?: TabId
    contentLoading: boolean
    contentLoadingLabel?: string
  }
  tabs: {
    showTabs: boolean
    activeTab: TabId
    onTabChange: (tab: TabId) => void
    tabs: { id: TabId; label: string }[]
  }
  actions?: {
    onReload?: () => void
  }
  inviteSheet: null | {
    gameId: string
    screenData: ScreenData
    handlers: RendererHandlers
    onClose: () => void
  }
}

export function AppView(props: AppViewProps) {
  const { shell, main, tabs, inviteSheet } = props

  return (
    <AppShell
      mode={shell.mode}
      shellSurface={shell.shellSurface}
      gameState={shell.gameState}
      showTabs={shell.showTabs}
      activeTab={shell.activeTab}
    >
      <SiteHeader
        mode={shell.mode}
        onBrandClick={() => {
          navigateToLauncher()
        }}
      />

      <AppMain
        mode={main.mode}
        activeTab={main.activeTab}
        schema={main.schema}
        pageData={main.pageData}
        pageHandlers={main.pageHandlers}
        pageRendererActiveTab={main.pageRendererActiveTab}
        contentLoading={main.contentLoading}
        contentLoadingLabel={main.contentLoadingLabel}
      />

      <AppTabs
        showTabs={tabs.showTabs}
        tabs={tabs.tabs}
        activeTab={tabs.activeTab}
        onTabChange={tabs.onTabChange}
      />

      <InviteLinksSheet inviteSheet={inviteSheet} />
    </AppShell>
  )
}
