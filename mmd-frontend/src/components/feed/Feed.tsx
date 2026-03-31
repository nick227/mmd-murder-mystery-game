import type { FeedItem, StageData } from '../../data/types'
import { FeedItemRow } from './FeedItemRow'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'
import { EmptyState } from '../ui/EmptyState'

interface Props {
  items: FeedItem[]
  stage?: StageData
  title?: string
  subtitle?: string
  emptyText?: string
  onItemClick?: (item: FeedItem) => void
}

export function Feed({
  items,
  stage,
  title = 'Room feed',
  subtitle = 'Live room updates',
  emptyText = 'No room updates yet.',
  onItemClick,
}: Props) {
  return (
    <Panel testId="feed">
      <PanelHeader title={title} meta={subtitle} />
      <div className="feed-list">
        {!items.length ? <EmptyState text={emptyText} /> : null}
        {items.map(item => <FeedItemRow key={item.id} item={item} stage={stage} onClick={onItemClick} />)}
      </div>
    </Panel>
  )
}

