import { useState } from 'react'
import type { PlayerGameTemplateProps } from './playerTemplateProps'
import { Stage } from '../../primitives'
import { Surface } from '../../ui/Surface'
import { DoNowPanel } from '../../surfaces/DoNowPanel'
import { EvidenceSection } from '../../surfaces/EvidenceSection'
import { FocusPanel } from '../../surfaces/FocusPanel'
import type { EvidenceItem } from '../../../data/types'

export function PlayerGameTemplate({
  stage,
  players,
  doNow,
  evidence,
  handlers,
}: PlayerGameTemplateProps) {
  const [focus, setFocus] = useState<EvidenceItem | null>(null)

  return (
    <Surface testId="surface-game" surface="game" dataUi="GameSurface">
      <Stage
        data={stage}
        players={players}
        showPlayers={false}
        showDescription={true}
        display="act"
      />
      <FocusPanel
        item={focus}
        onClose={() => setFocus(null)}
      />
      <DoNowPanel items={doNow} handlers={handlers} />
      <EvidenceSection
        items={evidence}
        currentAct={stage.act}
        onItemClick={setFocus}
      />
    </Surface>
  )
}
