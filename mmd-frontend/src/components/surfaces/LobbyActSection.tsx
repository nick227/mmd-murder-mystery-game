import { useState } from 'react'
import type {
  EvidenceItem,
  GameState,
  ObjectiveItem,
  RendererHandlers,
  RoomPlayer,
  StageData,
} from '../../data/types'
import { Stage } from '../primitives'
import { DoNowPanel } from './DoNowPanel'
import { EvidenceSection } from './EvidenceSection'
import { FocusPanel } from './FocusPanel'
import { ui } from '../../utils/uiMarkers'

type Props = {
  stage: StageData
  players: RoomPlayer[]
  doNow: ObjectiveItem[]
  evidence: EvidenceItem[]
  handlers?: RendererHandlers
  gameState: GameState
}

/** Current act, objectives, and evidence — same data as former Game tab; advances via host + poll. */
export function LobbyActSection({ stage, players, doNow, evidence, handlers, gameState }: Props) {
  const [focus, setFocus] = useState<EvidenceItem | null>(null)

  if (gameState === 'SCHEDULED') {
    return (
      <section className="screen-stack surface surface--game" data-testid="lobby-act" {...ui('LobbyActSection')}>
        <div className="waiting-state">
          <div className="waiting-state__icon">⏳</div>
          <h2 className="waiting-state__title">Waiting to start game</h2>
          <p className="waiting-state__subtitle">The host will begin the game soon.</p>
        </div>
      </section>
    )
  }

  return (
    <section className="screen-stack surface surface--game" data-testid="lobby-act" {...ui('LobbyActSection')}>
      <Stage
        data={stage}
        players={players}
        showPlayers={false}
        showDescription={true}
        display="act"
      />
      <FocusPanel item={focus} onClose={() => setFocus(null)} />
      <DoNowPanel items={doNow} handlers={handlers} />
      <EvidenceSection items={evidence} currentAct={stage.act} onItemClick={setFocus} />
    </section>
  )
}
