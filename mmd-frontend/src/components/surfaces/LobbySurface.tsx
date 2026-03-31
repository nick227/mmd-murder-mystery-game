import type { RendererHandlers, ScreenData } from '../../data/types'
import { PresenceRail } from '../presence/PresenceRail'
import { Feed } from '../feed/Feed'
import { Surface } from '../ui/Surface'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'

interface Props {
  data: ScreenData
  handlers?: RendererHandlers
}

export function LobbySurface({ data }: Props) {
  const roomOnly = data.feed.filter(item => (item.variant ?? 'room') === 'room')
  const statusLine =
    data.game.state === 'SCHEDULED'
      ? 'Waiting for the host to start.'
      : `Act ${data.game.act} is live. Go to Game to play.`

  return (
    <Surface testId="surface-lobby">
      <PresenceRail players={data.players} size="large" title="In the room" />
      <Panel>
        <PanelHeader title="Status" meta={data.game.state} />
        <div style={{ color: 'var(--text)', lineHeight: 1.45 }}>{statusLine}</div>
      </Panel>
      <Feed
        items={roomOnly}
        title="Room"
        subtitle="Joins and act changes"
        emptyText="No room updates yet."
      />
    </Surface>
  )
}

