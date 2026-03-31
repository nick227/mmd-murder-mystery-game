import { useMemo, useState } from 'react'
import type { RendererHandlers, ScreenData } from '../../data/types'
import type { usePinnedIds } from '../../hooks/useAppState'
import { Stage } from '../Primitives'
import { PresenceRail } from '../presence/PresenceRail'
import { Feed } from '../feed/Feed'
import { Surface } from '../ui/Surface'
import { DoNowPanel } from './DoNowPanel'
import { ComposerPanel } from './ComposerPanel'
import { EvidenceSection } from './EvidenceSection'
import { FocusPanel } from './FocusPanel'
import type { FocusItem } from './FocusPanel'

interface Props {
  data: ScreenData
  handlers?: RendererHandlers
  pins: ReturnType<typeof usePinnedIds>
}

export function GameSurface({ data, handlers, pins }: Props) {
  const [focus, setFocus] = useState<FocusItem | null>(null)

  const focusableFeed = useMemo(() => data.feed, [data.feed])
  const focusableEvidence = useMemo(() => data.view?.evidence ?? [], [data.view?.evidence])

  return (
    <Surface testId="surface-game">
      <PresenceRail players={data.players} size="compact" title="In the room" />
      <Stage data={data.game} players={data.players} showPlayers={false} />
      <DoNowPanel items={data.view?.doNow ?? []} handlers={handlers} />
      <Feed
        items={focusableFeed}
        stage={data.game}
        title="Live timeline"
        subtitle="Narration, moves, and room updates"
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

