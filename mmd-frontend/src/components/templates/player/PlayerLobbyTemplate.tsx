import type { PlayerLobbyTemplateProps } from './playerTemplateProps'
import { Surface } from '../../ui/Surface'
import { LOBBY_SECTION_ORDER } from './lobbySectionOrder'
import { LobbySection, renderLobbySection } from './lobbySectionLayout'

export function PlayerLobbyTemplate(props: PlayerLobbyTemplateProps) {
  return (
    <Surface testId="surface-lobby" surface="lobby" dataUi="LobbySurface">
      {LOBBY_SECTION_ORDER.map((id) => (
        <LobbySection key={id} id={id}>
          {renderLobbySection(id, props)}
        </LobbySection>
      ))}
    </Surface>
  )
}
