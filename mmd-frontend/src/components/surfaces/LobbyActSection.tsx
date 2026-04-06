import type {
  GameState,
  ObjectiveItem,
  RendererHandlers,
  RoomPlayer,
  StageData,
} from '../../data/types'
import { Stage } from '../primitives'
import { DoNowPanel } from './DoNowPanel'
import { ui } from '../../utils/uiMarkers'

type Props = {
  stage: StageData
  players: RoomPlayer[]
  doNow: ObjectiveItem[]
  handlers?: RendererHandlers
  gameState: GameState
}

/** Current act banner + objectives; evidence is a separate block below player cards. */
export function LobbyActSection({ stage, players, doNow, handlers, gameState }: Props) {

  return (
    <section className="lobby-stack surface surface--game" data-testid="lobby-act" {...ui('LobbyActSection')}>
      <Stage
        data={stage}
        players={players}
        showPlayers={false}
        showDescription={true}
        display="act"
      />
      <DoNowPanel items={doNow} handlers={handlers} />
    </section>
  )
}
