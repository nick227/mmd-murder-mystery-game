import type { FeedItem, StageData } from '../../data/types'
import { FeedItemRow } from './FeedItemRow'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'
import { EmptyState } from '../ui/EmptyState'

interface Props {
  items: FeedItem[]
  stage?: StageData
  title?: string
  emptyText?: string
  onItemClick?: (item: FeedItem) => void
}

export function Feed({
  items,
  stage,
  title = '',
  emptyText = 'No room updates yet.',
  onItemClick,
}: Props) {
  const orderedItems = [...items].reverse()

  return (
    <Panel testId="feed" dataUi="Feed">
      <PanelHeader title={title} />
      <div className="feed-list">
        {!items.length ? <EmptyState text={emptyText} /> : null}
        {orderedItems.map(item => <FeedItemRow key={item.id} item={item} stage={stage} onClick={onItemClick} />)}
      </div>
    </Panel>
  )
}
