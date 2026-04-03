import type { PlayerLobbyTemplateProps } from './playerTemplateProps'
import { ActionsBar } from '../../primitives'
import { JoinCard } from '../../primitives/JoinCard'
import { Stage } from '../../primitives'
import { PresenceRail } from '../../presence/PresenceRail'
import { Feed } from '../../feed/Feed'
import { Surface } from '../../ui/Surface'
import { Panel } from '../../ui/Panel'
import { PanelHeader } from '../../ui/PanelHeader'
import { ComposerPanel } from '../../surfaces/ComposerPanel'

export function PlayerLobbyTemplate({
  stage,
  players,
  feed,
  statusLine,
  join,
  joined,
  currentCharacterId,
  composer,
  handlers,
  hostActions,
  hostHandlers,
  hostError,
}: PlayerLobbyTemplateProps) {
  return (
    <Surface testId="surface-lobby" surface="lobby" dataUi="LobbySurface">
      <Stage
        data={stage}
        players={players}
        showPlayers={false}
        showDescription={Boolean((stage.storyBlurb ?? stage.description).trim())}
        display="story"
      />
      {!joined && join ? <JoinCard join={join} game={stage} handlers={handlers} /> : null}
      <PresenceRail players={players} size="large" title="In room" currentCharacterId={currentCharacterId} />
      {hostActions?.length ? (
        <Panel>
          <PanelHeader title="Host controls" />
          {hostError ? (
            <div className="panel__meta" style={{ marginBottom: 8, color: 'var(--danger)' }}>
              {hostError}
            </div>
          ) : null}
          <ActionsBar items={hostActions} handlers={hostHandlers} />
        </Panel>
      ) : null}
      <Panel>
        <PanelHeader title="Status" />
        <div style={{ color: 'var(--text)', lineHeight: 1.45 }}>{statusLine}</div>
      </Panel>
      <Feed
        items={feed}
        title="Timeline"
        emptyText="No timeline updates yet."
      />
      {joined && composer ? <ComposerPanel data={composer} handlers={handlers} /> : null}
    </Surface>
  )
}
