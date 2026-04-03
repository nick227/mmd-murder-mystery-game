import type { ApiPublicGameView, GameState, LauncherData, RendererHandlers, StoryListItem } from '../../../data/types'
import { navigateInAppFromHref } from '../../../app/inAppNavigation'
import { BottomSheet } from '../../ui/BottomSheet'
import { LauncherCharacterRow } from './LauncherCharacterRow'
import { LauncherStoryCard } from './LauncherStoryCard'

type Game = {
  id: string
  name?: string
  apiBase: string
  state?: GameState
  creatorUserId?: string | null
  creatorName?: string | null
  creatorAvatar?: string | null
  storyTitle?: string
  storySummary?: string
  storyImage?: string
  storyId?: string | null
  scheduledTime?: string
  locationText?: string | null
  access?: {
    hostKey?: string
    characterIds: string[]
  }
}

type Props = {
  game?: Game
  createdGame?: NonNullable<LauncherData['createdGame']>
  apiBase: string
  stories: StoryListItem[]
  publicGame?: ApiPublicGameView | null
  onClose: () => void
  onEditGame?: (game: Game) => void
  handlers?: RendererHandlers
}

function PlayerLinks({ game, apiBase, handlers }: { game: Game; apiBase: string; handlers?: RendererHandlers }) {
  if (!game.access?.characterIds?.length) return null

  return (
    <div className="link-list u-mt-12">
      <div className="field__label">Player links</div>
      {game.access.characterIds.map(characterId => {
        const url = `${window.location.origin}/room/${game.id}/${characterId}${game.apiBase && game.apiBase !== apiBase ? `?api=${encodeURIComponent(game.apiBase)}` : ''}`
        return (
          <div key={characterId} className="link-row">
            <strong>{`Player ${characterId}`}</strong>
            <code>{url}</code>
            <div className="link-row__actions">
              <button
                type="button"
                className="mini-btn"
                onClick={() => handlers?.onCopyText?.(url)}
              >
                Copy link
              </button>
              <button
                type="button"
                className="mini-btn"
                onClick={() => navigateInAppFromHref(url)}
              >
                Open
              </button>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function HostSetupSheet({
  game,
  createdGame,
  apiBase,
  stories,
  publicGame,
  onClose,
  onEditGame,
  handlers,
}: Props) {
  const currentGame = game || (createdGame ? {
    id: createdGame.id,
    name: createdGame.name,
    creatorUserId: createdGame.creatorUserId,
    creatorName: createdGame.creatorName,
    creatorAvatar: createdGame.creatorAvatar,
    apiBase,
    access: {
      hostKey: createdGame.hostKey,
      characterIds: createdGame.playerLinks.map(link => link.characterId),
    }
  } : undefined)

  const title = currentGame?.name?.trim().length ? currentGame.name.trim() : (currentGame ? 'Untitled game' : '')
  const story =
    currentGame?.storyId
      ? stories.find(s => s.id === currentGame.storyId) ?? null
      : publicGame?.story
      ? {
          id: publicGame.story.id,
          title: publicGame.story.title,
          summary: publicGame.story.summary,
          image: publicGame.story.image ?? undefined,
          characters: publicGame.story.characters.map(c => ({
            characterId: c.characterId,
            name: c.name,
            archetype: c.archetype,
            portrait: c.portrait,
          })),
        }
      : currentGame?.storyTitle || currentGame?.storyImage || currentGame?.storySummary
      ? {
          id: currentGame.id,
          title: currentGame.storyTitle ?? title,
          summary: currentGame.storySummary ?? '',
          image: currentGame.storyImage,
        }
      : null
  const joinCharacterId = currentGame?.access?.characterIds?.[0]
  const joinUrl =
    currentGame && joinCharacterId
      ? `${window.location.origin}/room/${currentGame.id}/${joinCharacterId}${
          currentGame.apiBase && currentGame.apiBase !== apiBase ? `?api=${encodeURIComponent(currentGame.apiBase)}` : ''
        }`
      : null

  return (
    <BottomSheet
      open={true}
      onClose={onClose}
      eyebrow="Game details"
      title={currentGame ? title : 'Game'}
      meta={currentGame ? 'Manage links and actions' : ''}
    >
      {currentGame ? (
        <div className="story-picker">
          {story ? (
            <LauncherStoryCard story={story} active={true} />
          ) : currentGame.storyTitle ? (
            <div className="story-option story-option--active">
              <div className="story-option__content">
                <strong>{currentGame.storyTitle}</strong>
              </div>
            </div>
          ) : null}

          <div className="field-grid u-mt-12">
            {currentGame.scheduledTime ? (
              <div className="field">
                <div className="field__label">Scheduled time</div>
                <div className="field__value">{new Date(currentGame.scheduledTime).toLocaleString()}</div>
              </div>
            ) : null}
            {currentGame.locationText ? (
              <div className="field">
                <div className="field__label">Location</div>
                <div className="field__value">{currentGame.locationText}</div>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {joinUrl ? (
        <div className="launcher-actions u-mt-12">
          <button type="button" className="action-btn action-btn--primary" onClick={() => joinUrl && navigateInAppFromHref(joinUrl)}>
            Join game
          </button>
        </div>
      ) : null}

      {currentGame && story && currentGame.access?.characterIds?.length ? (
        <div className="story-picker u-mt-12 flex flex-col">
          <div className="field__label">Rejoin as</div>
          {currentGame.access.characterIds.map(characterId => {
            const char = ('characters' in story && Array.isArray((story as StoryListItem).characters))
              ? (story as StoryListItem).characters?.find(c => c.characterId === characterId) ?? null
              : null
            const label = char?.name ?? `Character ${characterId}`
            const url = `${window.location.origin}/room/${currentGame.id}/${characterId}${
              currentGame.apiBase && currentGame.apiBase !== apiBase ? `?api=${encodeURIComponent(currentGame.apiBase)}` : ''
            }`
            return (
              <LauncherCharacterRow
                key={characterId}
                label={label}
                portrait={char?.portrait}
                onClick={() => navigateInAppFromHref(url)}
              />
            )
          })}
        </div>
      ) : null}

      {currentGame && !currentGame.access?.characterIds?.length && publicGame?.story?.characters?.length ? (
        <div className="story-picker u-mt-12 flex flex-col">
          <div className="field__label">Rejoin as</div>
          {publicGame.story.characters.map(char => {
            const url = `${window.location.origin}/room/${currentGame.id}/${char.characterId}${
              currentGame.apiBase && currentGame.apiBase !== apiBase ? `?api=${encodeURIComponent(currentGame.apiBase)}` : ''
            }`
            return (
              <LauncherCharacterRow
                key={char.characterId}
                label={char.name}
                portrait={char.portrait}
                onClick={() => navigateInAppFromHref(url)}
              />
            )
          })}
        </div>
      ) : null}

      {currentGame && <PlayerLinks game={currentGame} apiBase={apiBase} handlers={handlers} />}

      {currentGame?.access?.hostKey ? (
        <div className="launcher-actions u-mt-12">
          {currentGame.state === 'SCHEDULED' ? (
            <button type="button" className="action-btn action-btn--secondary" onClick={() => onEditGame?.(currentGame)}>
              Edit game
            </button>
          ) : null}
          <button
            type="button"
            className="action-btn action-btn--danger"
            onClick={async () => {
              const ok = window.confirm('Cancel this game? This cannot be undone.')
              if (!ok) return
              await handlers?.onCancelGame?.(currentGame.id, currentGame.access!.hostKey!)
              onClose()
            }}
          >
            Cancel game
          </button>
        </div>
      ) : null}

      {currentGame?.access?.hostKey ? (
        <div className="link-row__actions link-row__actions--stack u-mt-12">
          <button
            type="button"
            className="mini-btn"
            onClick={() => {
              const hostUrl = `${window.location.origin}/host/${currentGame.id}?hostKey=${currentGame.access!.hostKey!}${currentGame.apiBase ? `&api=${encodeURIComponent(currentGame.apiBase)}` : ''}`
              navigateInAppFromHref(hostUrl)
            }}
          >
            Open host
          </button>
          <button
            type="button"
            className="mini-btn"
            onClick={() => {
              const hostUrl = `${window.location.origin}/host/${currentGame.id}?hostKey=${currentGame.access!.hostKey!}${currentGame.apiBase ? `&api=${encodeURIComponent(currentGame.apiBase)}` : ''}`
              handlers?.onCopyText?.(hostUrl)
            }}
          >
            Copy host link
          </button>
        </div>
      ) : null}
    </BottomSheet>
  )
}
