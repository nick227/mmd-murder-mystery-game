import type { PageSchema, RendererHandlers, ScreenData, TabId, ViewMode } from '../../data/types'
import { PageRenderer } from '../PageRenderer'
import { RoomRouter } from '../../app/RoomRouter'

export interface AppMainProps {
  mode: ViewMode
  activeTab: TabId
  schema: PageSchema
  pageData: ScreenData
  pageHandlers: RendererHandlers
  pageRendererActiveTab?: TabId
  /** Main column only; header and tabs stay visible (initial load / route change). */
  contentLoading?: boolean
}

export function AppMain(props: AppMainProps) {
  const { mode, activeTab, schema, pageData, pageHandlers, pageRendererActiveTab, contentLoading } = props

  if (contentLoading) {
    return (
      <div className="app-main app-main--loading" role="status" aria-live="polite" aria-busy="true">
        <div className="main-loading">
          <div className="main-loading__spinner" aria-hidden />
          <p className="main-loading__label">Loading…</p>
        </div>
      </div>
    )
  }

  return mode === 'room' ? (
    <RoomRouter activeTab={activeTab} />
  ) : (
    <PageRenderer
      schema={schema}
      data={pageData}
      activeTab={pageRendererActiveTab}
      handlers={pageHandlers}
    />
  )
}
