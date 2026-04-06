import type { ReactNode } from 'react'
import type { PlayerLobbyTemplateProps } from './playerTemplateProps'
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
import type { LobbySectionId } from './lobbySectionOrder'

/** Full-width column segment inside the lobby scroll; keeps nested panels/stages aligned. */
export function LobbySection({ id, children }: { id: LobbySectionId; children: ReactNode }) {
  if (children == null) return null
  return (
    <div className="lobby-section" data-lobby-section={id}>
      {children}
    </div>
  )
}

export function renderLobbySection(id: LobbySectionId, p: PlayerLobbyTemplateProps): ReactNode {
  switch (id) {
    case 'meta':
      return <LobbyMetaPanel stage={p.stage} />
    case 'join':
      return !p.joined && p.join ? (
        <LobbyJoinSection join={p.join} stage={p.stage} handlers={p.handlers} />
      ) : null
    case 'room':
      return <LobbyRoomList players={p.players} currentCharacterId={p.currentCharacterId} />
    case 'host':
      return p.hostActions?.length ? (
        <LobbyHostControls
          hostActions={p.hostActions}
          hostHandlers={p.hostHandlers}
          hostError={p.hostError}
        />
      ) : null
    case 'status':
      return <LobbyStatusPanel statusLine={p.statusLine} />
    case 'story':
      return <LobbyStoryStage stage={p.stage} players={p.players} />
    case 'profile':
      return p.joined ? <LobbyPlayerSurface profile={p.profile} /> : null
    case 'act':
      return p.joined ? (
        <LobbyActBlock
          stage={p.stage}
          players={p.players}
          doNow={p.doNow}
          handlers={p.handlers}
          gameState={p.gameState}
        />
      ) : null
    case 'players':
      return p.joined && p.players.length > 0 ? <LobbyPlayersPanel players={p.players} /> : null
    case 'evidence':
      return p.joined ? <LobbyEvidenceBlock evidence={p.evidence} currentAct={p.stage.act} /> : null
    case 'composer':
      return p.joined && p.composer ? <LobbyComposer composer={p.composer} handlers={p.handlers} /> : null
    case 'feed':
      return <LobbyFeed feed={p.feed} />
  }
}
