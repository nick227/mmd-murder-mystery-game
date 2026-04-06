import type { PropsWithChildren } from 'react'
import type { ActionItem, EvidenceItem, FeedItem, GameState, ObjectiveItem, RendererHandlers, RoomPlayer, ScreenData, StageData } from '../../../data/types'
import { ActionsBar } from '../../primitives'
import { JoinCard } from '../../primitives/JoinCard'
import { Pills } from '../../primitives/Pills'
import { Stage } from '../../primitives'
import { PresenceRail } from '../../presence/PresenceRail'
import { Feed } from '../../feed/Feed'
import { Panel } from '../../ui/Panel'
import { PanelHeader } from '../../ui/PanelHeader'
import { ComposerPanel } from '../../surfaces/ComposerPanel'
import { LobbyActSection } from '../../surfaces/LobbyActSection'
import { LobbyEvidenceSection } from '../../surfaces/LobbyEvidenceSection'
import { PlayerProfileTemplate } from './PlayerProfileTemplate'
import { lobbyHostLabel, lobbyLocationLabel, lobbyStoryDescriptionVisible } from './lobbyDisplay'

function PanelBlock(
  props: PropsWithChildren<{
    title: string
    meta?: string
    className?: string
    dataUi?: string
    testId?: string
  }>,
) {
  const { title, meta, className, dataUi, testId, children } = props
  return (
    <Panel className={className} dataUi={dataUi} testId={testId}>
      <PanelHeader title={title} meta={meta} />
      {children}
    </Panel>
  )
}

export function LobbyMetaPanel({ stage }: { stage: StageData }) {
  const hostName = lobbyHostLabel(stage)
  const locationText = lobbyLocationLabel(stage)
  return (
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
  )
}

export function LobbyJoinSection({
  join,
  stage,
  handlers,
}: {
  join: NonNullable<ScreenData['join']>
  stage: StageData
  handlers?: RendererHandlers
}) {
  return <JoinCard join={join} game={stage} handlers={handlers} />
}

export function LobbyRoomList({
  players,
  currentCharacterId,
}: {
  players: RoomPlayer[]
  currentCharacterId?: string | null
}) {
  return <PresenceRail players={players} size="large" title="In room" currentCharacterId={currentCharacterId} />
}

export function LobbyHostControls({
  hostActions,
  hostHandlers,
  hostError,
}: {
  hostActions: ActionItem[]
  hostHandlers?: RendererHandlers
  hostError?: string
}) {
  return (
    <PanelBlock title="Host controls">
      {hostError ? (
        <div className="panel__meta" style={{ marginBottom: 8, color: 'var(--danger)' }}>
          {hostError}
        </div>
      ) : null}
      <ActionsBar items={hostActions} handlers={hostHandlers} />
    </PanelBlock>
  )
}

export function LobbyStatusPanel({ statusLine }: { statusLine: string }) {
  return (
    <PanelBlock title="Status">
      <div style={{ color: 'var(--text)', lineHeight: 1.45 }}>{statusLine}</div>
    </PanelBlock>
  )
}

export function LobbyStoryStage({ stage, players }: { stage: StageData; players: RoomPlayer[] }) {
  return (
    <Stage
      data={stage}
      players={players}
      showPlayers={false}
      showDescription={lobbyStoryDescriptionVisible(stage)}
      display="story"
    />
  )
}

export function LobbyPlayerSurface({ profile }: { profile: ScreenData['profile'] }) {
  return <PlayerProfileTemplate profile={profile} embedded />
}

export function LobbyActBlock({
  stage,
  players,
  doNow,
  handlers,
  gameState,
}: {
  stage: StageData
  players: RoomPlayer[]
  doNow: ObjectiveItem[]
  handlers?: RendererHandlers
  gameState: GameState
}) {
  return (
    <LobbyActSection
      stage={stage}
      players={players}
      doNow={doNow}
      handlers={handlers}
      gameState={gameState}
    />
  )
}

export function LobbyPlayersPanel({ players }: { players: RoomPlayer[] }) {
  return (
    <PanelBlock title="Players" meta={String(players.length)} dataUi="PlayerCardsPanel">
      <div className="player-pills">
        <Pills players={players} />
      </div>
    </PanelBlock>
  )
}

export function LobbyEvidenceBlock({ evidence, currentAct }: { evidence: EvidenceItem[]; currentAct: number }) {
  return <LobbyEvidenceSection evidence={evidence} currentAct={currentAct} />
}

export function LobbyComposer({
  composer,
  handlers,
}: {
  composer: NonNullable<ScreenData['composer']>
  handlers?: RendererHandlers
}) {
  return <ComposerPanel data={composer} handlers={handlers} />
}

export function LobbyFeed({ feed }: { feed: FeedItem[] }) {
  return <Feed items={feed} title="" emptyText="No timeline updates yet." />
}
