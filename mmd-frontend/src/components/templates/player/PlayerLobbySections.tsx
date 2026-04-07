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

export function LobbyMetaPanelWithHostAction({
  stage,
  exportActions,
  handlers,
}: {
  stage: StageData
  exportActions?: ActionItem[]
  handlers?: RendererHandlers
}) {
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
      {exportActions && exportActions.length ? (
        <div className="lobby-meta__row lobby-meta__row--downloads">
          <div className="lobby-meta__label">Downloads</div>
          <div className="lobby-meta__value lobby-meta__value--downloads">
            <div className="lobby-meta__downloads">
              {exportActions.map(action => (
                <button
                  key={action.id}
                  type="button"
                  className={`action-btn action-btn--${action.kind ?? 'secondary'} lobby-meta__downloadBtn`}
                  disabled={action.disabled}
                  onClick={() => {
                    if (action.id === 'download-cards' && stage.storyId) {
                      void handlers?.onDownloadStoryCards?.({
                        storyId: stage.storyId,
                        storyTitle: stage.storyTitle ?? stage.subtitle,
                      })
                      return
                    }
                    if (action.id === 'download-cards-pdf' && stage.storyId) {
                      void handlers?.onDownloadStoryCardsPdf?.({
                        storyId: stage.storyId,
                        storyTitle: stage.storyTitle ?? stage.subtitle,
                      })
                      return
                    }
                    handlers?.onAction?.(action.id)
                  }}
                >
                  {action.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
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
  const visibleActions = hostActions.filter(action => action.id !== 'download-cards' && action.id !== 'download-cards-pdf')
  if (!visibleActions.length && !hostError) return null
  return (
    <PanelBlock title="Host controls">
      {hostError ? (
        <div className="panel__meta" style={{ marginBottom: 8, color: 'var(--danger)' }}>
          {hostError}
        </div>
      ) : null}
      {visibleActions.length ? <ActionsBar items={visibleActions} handlers={hostHandlers} /> : null}
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
