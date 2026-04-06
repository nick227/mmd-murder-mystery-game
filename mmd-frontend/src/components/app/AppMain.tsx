import type { PageSchema, RendererHandlers, ScreenData, TabId, ViewMode } from '../../data/types'
import { RoomRouter } from '../../app/RoomRouter'
import { PageRenderer } from '../PageRenderer'
import { ContentLoadingState } from './ContentLoadingState'

export interface AppMainProps {
  mode: ViewMode
  activeTab: TabId
  schema: PageSchema
  pageData: ScreenData
  pageHandlers: RendererHandlers
  pageRendererActiveTab?: TabId
  /** Main column only; header and tabs stay visible (initial load / route change). */
  contentLoading?: boolean
  contentLoadingLabel?: string
}

export function AppMain(props: AppMainProps) {
  const {
    mode,
    activeTab,
    schema,
    pageData,
    pageHandlers,
    pageRendererActiveTab,
    contentLoading,
    contentLoadingLabel,
  } = props

  if (contentLoading) {
    return (
      <div className="app-main app-main--loading">
        <ContentLoadingState label={contentLoadingLabel} />
      </div>
    )
  }

  return mode === 'room' ? (
    <RoomRouter />
  ) : (
    <PageRenderer
      schema={schema}
      data={pageData}
      activeTab={pageRendererActiveTab}
      handlers={pageHandlers}
    />
  )
}
