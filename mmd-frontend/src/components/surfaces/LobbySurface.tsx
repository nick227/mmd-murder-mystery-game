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
      : `Act ${data.game.act} is live. Objectives and evidence are below your character.`

  return (
    <PlayerLobbyTemplate
      stage={data.game}
      players={data.players}
      feed={data.feed}
      profile={data.profile}
      doNow={data.view?.doNow ?? []}
      evidence={data.view?.evidence ?? []}
      gameState={data.game.state}
      statusLine={statusLine}
      join={data.join}
      joined={joined}
      currentCharacterId={currentCharacterId}
      composer={data.composer}
      handlers={handlers}
      exportActions={data.gameActions.filter(action => action.id === 'download-cards' || action.id === 'download-cards-pdf')}
      hostActions={hostActions}
      hostHandlers={hostHandlers}
      hostError={hostError}
    />
  )
}
