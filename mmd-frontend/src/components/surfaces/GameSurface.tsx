import type { RendererHandlers, ScreenData } from '../../data/types'
import { PlayerGameTemplate } from '../templates/player/PlayerGameTemplate'

interface Props {
  data: ScreenData
  handlers?: RendererHandlers
}

export function GameSurface({ data, handlers }: Props) {
  return (
    <PlayerGameTemplate
      stage={data.game}
      players={data.players}
      doNow={data.view?.doNow ?? []}
      evidence={data.view?.evidence ?? []}
      handlers={handlers}
      gameState={data.game.state}
    />
  )
}
