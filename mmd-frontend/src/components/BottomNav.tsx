import type { TabId, TabSchema } from '../data/types'
import { ui } from '../utils/uiMarkers'

interface Props {
  tabs: TabSchema[]
  activeTab: TabId
  onChange: (tab: TabId) => void
}

export function BottomNav({ tabs, activeTab, onChange }: Props) {
  return (
    <nav className="bottom-nav" {...ui('BottomNav')}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          data-testid={`bottom-nav-${tab.id}`}
          data-tab={tab.id}
          className={tab.id === activeTab ? 'bottom-nav__button bottom-nav__button--active' : 'bottom-nav__button'}
          onClick={() => onChange(tab.id)}
        >
          {tab.label}
        </button>
      ))}
    </nav>
  )
}
