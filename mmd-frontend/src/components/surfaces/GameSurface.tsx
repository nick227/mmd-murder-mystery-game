import { useMemo, useState } from 'react'
import type { ActionItem, RendererHandlers, ScreenData } from '../../data/types'
import type { usePinnedIds } from '../../hooks/useAppState'
import { ActionsBar, Stage } from '../primitives'
import { PresenceRail } from '../presence/PresenceRail'
import { Feed } from '../feed/Feed'
import { Surface } from '../ui/Surface'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'
import { DoNowPanel } from './DoNowPanel'
import { ComposerPanel } from './ComposerPanel'
import { EvidenceSection } from './EvidenceSection'
import { FocusPanel } from './FocusPanel'
import type { FocusItem } from './FocusPanel'

interface Props {
  data: ScreenData
  handlers?: RendererHandlers
  pins: ReturnType<typeof usePinnedIds>
  /** After the game starts, host pacing controls live on Game (lobby holds Start). */
  hostActions?: ActionItem[]
  hostHandlers?: RendererHandlers
  hostError?: string
}

export function GameSurface({ data, handlers, pins, hostActions, hostHandlers, hostError }: Props) {
  const [focus, setFocus] = useState<FocusItem | null>(null)

  const focusableFeed = useMemo(() => data.feed, [data.feed])
  const focusableEvidence = useMemo(() => data.view?.evidence ?? [], [data.view?.evidence])

  return (
    <Surface testId="surface-game" surface="game" dataUi="GameSurface">
      <PresenceRail players={data.players} size="compact" title="In the room" />
      {hostActions?.length ? (
        <Panel>
          <PanelHeader title="Host controls" meta={data.game.state} />
          {hostError ? (
            <div className="panel__meta" style={{ marginBottom: 8, color: 'var(--danger)' }}>
              {hostError}
            </div>
          ) : null}
          <ActionsBar items={hostActions} handlers={hostHandlers} />
        </Panel>
      ) : null}
      <Stage data={data.game} players={data.players} showPlayers={false} />
      <DoNowPanel items={data.view?.doNow ?? []} handlers={handlers} />
      <Feed
        items={focusableFeed}
        stage={data.game}
        title="Live timeline"
        subtitle="Narration, feed posts, and room updates"
        onItemClick={(item) => setFocus({ kind: 'feed', item })}
      />
      <ComposerPanel data={data.composer} handlers={handlers} />
      <EvidenceSection
        items={focusableEvidence}
        currentAct={data.game.act}
        onItemClick={(item) => setFocus({ kind: 'evidence', item })}
      />
      <FocusPanel
        focus={focus}
        onClose={() => setFocus(null)}
        isPinned={pins.isPinned}
        onTogglePin={pins.togglePinned}
      />
    </Surface>
  )
}

