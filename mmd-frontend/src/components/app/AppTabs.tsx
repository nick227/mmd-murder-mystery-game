import type { TabId } from '../../data/types'
import { BottomNav } from '../BottomNav'

export interface AppTabsProps {
  showTabs: boolean
  activeTab: TabId
  onTabChange: (tab: TabId) => void
  tabs: { id: TabId; label: string }[]
}

export function AppTabs(props: AppTabsProps) {
  const { showTabs, activeTab, onTabChange, tabs } = props

  return showTabs && tabs.length ? (
    <BottomNav tabs={tabs} activeTab={activeTab} onChange={onTabChange} />
  ) : null
}
