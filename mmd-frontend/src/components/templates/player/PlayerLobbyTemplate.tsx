import type { PlayerLobbyTemplateProps } from './playerTemplateProps'
import { ActionsBar } from '../../primitives'
import { JoinCard } from '../../primitives/JoinCard'
import { Pills } from '../../primitives/Pills'
import { Stage } from '../../primitives'
import { PresenceRail } from '../../presence/PresenceRail'
import { Feed } from '../../feed/Feed'
import { Surface } from '../../ui/Surface'
import { Panel } from '../../ui/Panel'
import { PanelHeader } from '../../ui/PanelHeader'
import { ComposerPanel } from '../../surfaces/ComposerPanel'
import { LobbyActSection } from '../../surfaces/LobbyActSection'
import { LobbyEvidenceSection } from '../../surfaces/LobbyEvidenceSection'
import { PlayerProfileTemplate } from './PlayerProfileTemplate'

export function PlayerLobbyTemplate({
  stage,
  players,
  feed,
  profile,
  doNow,
  evidence,
  gameState,
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
  const hostName = stage.hostName && stage.hostName.trim().length ? stage.hostName.trim() : 'Host'
  const locationText = stage.locationText && stage.locationText.trim().length ? stage.locationText.trim() : 'Location TBD'

  return (
    <Surface testId="surface-lobby" surface="lobby" dataUi="LobbySurface">
      <Panel className="lobby-meta" dataUi="LobbyMeta">
        <PanelHeader title="Game details" />
        <div className="lobby-meta__row">
          <div className="lobby-meta__label">Game</div>
          <div className="lobby-meta__value">{stage.subtitle}</div>
        </div>
        <div className="lobby-meta__row">
          <div className="lobby-meta__label">Host</div>
          <div className="lobby-meta__value">{hostName}</div>
        </div>
        <div className="lobby-meta__row">
          <div className="lobby-meta__label">Location</div>
          <div className="lobby-meta__value">{locationText}</div>
        </div>
      </Panel>
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
      <Stage
        data={stage}
        players={players}
        showPlayers={false}
        showDescription={Boolean((stage.storyBlurb ?? stage.description).trim())}
        display="story"
      />
      {joined ? <PlayerProfileTemplate profile={profile} embedded /> : null}
      {joined ? (
        <LobbyActSection
          stage={stage}
          players={players}
          doNow={doNow}
          handlers={handlers}
          gameState={gameState}
        />
      ) : null}
      {joined && players.length > 0 ? (
        <Panel dataUi="PlayerCardsPanel">
          <PanelHeader title="Players" meta={String(players.length)} />
          <div className="player-pills">
            <Pills players={players} />
          </div>
        </Panel>
      ) : null}
      {joined ? <LobbyEvidenceSection evidence={evidence} currentAct={stage.act} /> : null}
      {joined && composer ? <ComposerPanel data={composer} handlers={handlers} /> : null}
      <Feed
        items={feed}
        title=""
        emptyText="No timeline updates yet."
      />
    </Surface>
  )
}
