import type { PlayerLobbyTemplateProps } from './playerTemplateProps'
import { Surface } from '../../ui/Surface'
import {
  LobbyActBlock,
  LobbyComposer,
  LobbyEvidenceBlock,
  LobbyFeed,
  LobbyJoinSection,
  LobbyMetaPanel,
  LobbyPlayerSurface,
  LobbyPlayersPanel,
  LobbyRoomList,
  LobbyHostControls,
  LobbyStatusPanel,
  LobbyStoryStage,
} from './PlayerLobbySections'

export function PlayerLobbyTemplate({
  stage,
  players,
  feed,
  profile,
  doNow,
  evidence,
  gameState,
  statusLine,
  join,
  joined,
  currentCharacterId,
  composer,
  handlers,
  hostActions,
  hostHandlers,
  hostError,
}: PlayerLobbyTemplateProps) {
  return (
    <Surface testId="surface-lobby" surface="lobby" dataUi="LobbySurface">
      <LobbyMetaPanel stage={stage} />
      {!joined && join ? <LobbyJoinSection join={join} stage={stage} handlers={handlers} /> : null}
      <LobbyRoomList players={players} currentCharacterId={currentCharacterId} />
      {hostActions?.length ? (
        <LobbyHostControls hostActions={hostActions} hostHandlers={hostHandlers} hostError={hostError} />
      ) : null}
      <LobbyStatusPanel statusLine={statusLine} />
      <LobbyStoryStage stage={stage} players={players} />
      {joined ? <LobbyPlayerSurface profile={profile} /> : null}
      {joined ? (
        <LobbyActBlock
          stage={stage}
          players={players}
          doNow={doNow}
          handlers={handlers}
          gameState={gameState}
        />
      ) : null}
      {joined && players.length > 0 ? <LobbyPlayersPanel players={players} /> : null}
      {joined ? <LobbyEvidenceBlock evidence={evidence} currentAct={stage.act} /> : null}
      {joined && composer ? <LobbyComposer composer={composer} handlers={handlers} /> : null}
      <LobbyFeed feed={feed} />
    </Surface>
  )
}
