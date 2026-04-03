import type { ActionItem, RendererHandlers, ScreenData } from '../../data/types'
import { PlayerLobbyTemplate } from '../templates/player/PlayerLobbyTemplate'

interface Props {
  data: ScreenData
  handlers?: RendererHandlers
  joined?: boolean
  currentCharacterId?: string | null
  /** Host pacing controls (Start / Next act / Finish) when viewing the room with a host key */
  hostActions?: ActionItem[]
  hostHandlers?: RendererHandlers
  hostError?: string
}

export function LobbySurface({ data, handlers, joined, currentCharacterId, hostActions, hostHandlers, hostError }: Props) {
  const statusLine =
    data.game.state === 'SCHEDULED'
      ? 'Waiting for the host to start.'
      : `Act ${data.game.act} is live. Follow the timeline here and use Game for objectives and evidence.`

  return (
    <PlayerLobbyTemplate
      stage={data.game}
      players={data.players}
      feed={data.feed}
      statusLine={statusLine}
      join={data.join}
      joined={joined}
      currentCharacterId={currentCharacterId}
      composer={data.composer}
      handlers={handlers}
      hostActions={hostActions}
      hostHandlers={hostHandlers}
      hostError={hostError}
    />
  )
}
