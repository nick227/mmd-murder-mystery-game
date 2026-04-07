import { useEffect, useRef, useState } from 'react'
import type { LauncherData, RendererHandlers, ApiGameSummary, StoryListItem } from '../../../data/types'
import { navigateInAppFromHref } from '../../../app/inAppNavigation'
import { HostSetupSheet } from './HostSetupSheet'
import { CreateEditGameSheet } from './CreateEditGameSheet'
import { Media } from '../../ui/Media'
import { useAuth } from '../../../hooks/useAuth'
import { fetchStoryById } from '../../../data/api'
import { exportStoryCardsAsPdf, exportStoryCardsAsZip } from '../../../features/storyCardExport/storyCardExport'

// Convert ApiGameSummary to HostSetupSheet Game type
function apiGameToGameWithStory(apiGame: ApiGameSummary, story?: StoryListItem) {
  return {
    id: apiGame.id,
    name: apiGame.name,
    apiBase: '', // Not available in ApiGameSummary, will use data.apiBase
    state: apiGame.state,
    creatorUserId: apiGame.creatorUserId,
    creatorName: apiGame.creatorName,
    creatorAvatar: apiGame.creatorAvatar,
    storyTitle: story?.title,
    storySummary: story?.summary,
    storyImage: story?.image,
    storyId: apiGame.storyId,
    scheduledTime: apiGame.scheduledTime,
    locationText: apiGame.locationText,
  }
}

function formatScheduledTime(scheduledTime?: string) {
  if (!scheduledTime) return ''
  const date = new Date(scheduledTime)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

export function LauncherCard({ data, handlers }: {
  data: LauncherData;
  handlers?: RendererHandlers;
}) {
  const { user, isLoading, login } = useAuth()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeGame, setActiveGame] = useState<ApiGameSummary | undefined>()
  const openedForGameIdRef = useRef<string | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create')
  const [editTarget, setEditTarget] = useState<ApiGameSummary | null>(null)
  const [createStoryId, setCreateStoryId] = useState<string>('')
  const [exportingStoryId, setExportingStoryId] = useState<string | null>(null)
  const [exportingFormat, setExportingFormat] = useState<'zip' | 'pdf' | null>(null)
  const [exportProgress, setExportProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 })
  const [exportError, setExportError] = useState('')
  const [authError, setAuthError] = useState('')
  const [authenticating, setAuthenticating] = useState(false)

  const loadingMore = data.loadingMore ?? false
  const hasMoreGames = data.hasMoreGames ?? false

  useEffect(() => {
    const cg = data.createdGame
    if (!cg || openedForGameIdRef.current === cg.id) return
    openedForGameIdRef.current = cg.id
    setActiveGame(undefined)
    setSheetOpen(true)
  }, [data.createdGame])

  // Use API games directly - no more merge logic needed
  const displayedGames = data.allGames

  const handleLoadMore = async () => {
    if (loadingMore || !hasMoreGames) return
    await handlers?.onLoadMoreGames?.()
  }

  const handleDownloadStoryCards = async (story: StoryListItem) => {
    setExportError('')
    setExportingStoryId(story.id)
    setExportingFormat('zip')
    setExportProgress({ completed: 0, total: 0 })
    try {
      const fullStory = await fetchStoryById(data.apiBase, story.id)
      await exportStoryCardsAsZip({
        storyId: story.id,
        storyTitle: story.title || fullStory.title || 'story',
        raw: fullStory.dataJson,
        onProgress: (completed, total) => setExportProgress({ completed, total }),
      })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export story cards')
    } finally {
      setExportingStoryId(null)
      setExportingFormat(null)
      setExportProgress({ completed: 0, total: 0 })
    }
  }

  const handleDownloadStoryPdf = async (story: StoryListItem) => {
    setExportError('')
    setExportingStoryId(story.id)
    setExportingFormat('pdf')
    setExportProgress({ completed: 0, total: 0 })
    try {
      const fullStory = await fetchStoryById(data.apiBase, story.id)
      await exportStoryCardsAsPdf({
        storyId: story.id,
        storyTitle: story.title || fullStory.title || 'story',
        raw: fullStory.dataJson,
        onProgress: (completed, total) => setExportProgress({ completed, total }),
      })
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Failed to export PDF')
    } finally {
      setExportingStoryId(null)
      setExportingFormat(null)
      setExportProgress({ completed: 0, total: 0 })
    }
  }
  const editSheetStories =
    editMode === 'create' && createStoryId
      ? data.stories.filter(story => story.id === createStoryId)
      : data.stories

  return (
    <>
      <section className="panel">
        {!data.stories.length ? (
          <div className="empty-state">Stories not loaded yet. Make sure the API is running.</div>
        ) : (
          <div className="story-picker">
            {data.stories.map(story => (
              <div key={story.id} className="story-option">
                <div className="story-option__title">
                  {story.title}
                </div>
                {story.image ? (
                  <div className="story-option__image">
                    <Media
                      src={story.image}
                      alt={`${story.title} story image`}
                      variant="hero"
                      ratio="16:9"
                      fit="cover"
                      fallback={{ type: 'gradient', label: story.title }}
                    />
                  </div>
                ) : null}
                <div className={`story-option__content${!story.image ? ' story-option__content--no-image' : ''
                  }`}>
                  <span>{story.summary}</span>
                  {(() => {
                    const stats = [
                      { label: 'Characters', value: story.characterCount ?? story.characters?.length },
                      { label: 'Cards', value: story.cardCount },
                      { label: 'Clues', value: story.clueCount },
                      { label: 'Puzzles', value: story.puzzleCount },
                      { label: 'Secrets', value: story.secretCount },
                    ]
                    const hasStats = stats.some(stat => typeof stat.value === 'number')
                    const storyMeta = story.storyMeta ?? []
                    const meta = storyMeta
                      .filter(item => item.key === 'Story rating' || item.key === 'Story themes')

                    if (!hasStats && meta.length === 0) return null
                    return (
                      <div className="story-option__details">
                        <div className="story-option__stats">
                          {stats.map(stat => (
                            <span key={stat.label} className="story-option__stat">
                              {stat.label}: {typeof stat.value === 'number' ? stat.value : '—'}
                            </span>
                          ))}
                        </div>
                        {meta.length ? (
                          <div className="story-option__meta">
                            {meta.map((entry, idx) => (
                              <span className="story-option__meta-value">{entry.value || '—'}</span>
                            ))}
                          </div>
                        ) : null}
                      </div>
                    )
                  })()}
                </div>
                <div className="launcher-actions u-mt-12 list-row">
                  <button
                    type="button"
                    className="action-btn action-btn--secondary"
                    disabled={exportingStoryId !== null}
                    onClick={() => void handleDownloadStoryCards(story)}
                  >
                    {exportingStoryId === story.id
                      && exportingFormat === 'zip'
                      ? (exportProgress.total > 0
                        ? `Downloading... ${exportProgress.completed} / ${exportProgress.total}`
                        : 'Downloading...')
                      : 'Download as cards'}
                  </button>
                  <button
                    type="button"
                    className="action-btn action-btn--secondary"
                    disabled={exportingStoryId !== null}
                    onClick={() => void handleDownloadStoryPdf(story)}
                  >
                    {exportingStoryId === story.id
                      && exportingFormat === 'pdf'
                      ? (exportProgress.total > 0
                        ? `Building PDF... ${exportProgress.completed} / ${exportProgress.total}`
                        : 'Building PDF...')
                      : 'Download PDF (Print)'}
                  </button>
                  <button
                    type="button"
                    className="action-btn action-btn--primary"
                    disabled={isLoading || authenticating || exportingStoryId !== null}
                    onClick={async () => {
                      setAuthError('')
                      setAuthenticating(true)
                      let activeUser = user
                      try {
                        activeUser = activeUser ?? (await login())
                      } finally {
                        setAuthenticating(false)
                      }
                      if (!activeUser) {
                        setAuthError('Sign in with Google to create a game.')
                        return
                      }
                      setCreateStoryId(story.id)
                      setEditMode('create')
                      setEditTarget(null)
                      setEditSheetOpen(true)
                    }}
                  >
                    Create game
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
        {authError ? <div className="empty-state u-mt-12">{authError}</div> : null}
        {exportError ? <div className="empty-state u-mt-12">{exportError}</div> : null}
      </section>

      {sheetOpen ? (
        <HostSetupSheet
          game={activeGame ? apiGameToGameWithStory(activeGame, data.stories.find(s => s.id === activeGame.storyId)) : undefined}
          createdGame={data.createdGame}
          apiBase={data.apiBase}
          stories={data.stories}
          publicGame={data.activeGamePublicKey && activeGame ? (data.activeGamePublicKey === `${data.apiBase}:${activeGame.id}` ? data.activeGamePublic ?? null : null) : null}
          onClose={() => setSheetOpen(false)}
          onEditGame={(g) => {
            setEditMode('edit')
            setEditTarget(g as unknown as ApiGameSummary) // Store as ApiGameSummary for editing
            setEditSheetOpen(true)
          }}
          handlers={handlers}
        />
      ) : null}

      {editSheetOpen ? (
        <CreateEditGameSheet
          open={true}
          mode={editMode}
          apiBase={data.apiBase}
          stories={editSheetStories}
          existingGame={editTarget ?? undefined}
          initial={{
            storyId: editTarget?.storyId ?? (createStoryId || data.form.storyId),
            name: editTarget?.name ?? data.form.name,
            scheduledTime: (editTarget?.scheduledTime ?? data.form.scheduledTime).slice(0, 16),
            locationText: (editTarget?.locationText ?? data.form.locationText) ?? '',
            characterId: '',
          }}
          onClose={() => {
            setEditSheetOpen(false)
            setCreateStoryId('')
          }}
          onSuccess={() => {
            // Close sheets after successful create submission
            setEditSheetOpen(false)
            setSheetOpen(false)
            setCreateStoryId('')
          }}
          onSubmit={async draft => {
            if (editMode === 'create') {
              await handlers?.onLauncherSubmitGame?.({
                mode: 'create',
                apiBase: data.apiBase,
                storyId: draft.storyId,
                name: draft.name,
                scheduledTime: draft.scheduledTime,
                locationText: draft.locationText,
                characterId: draft.characterId,
              })
              return
            }
            await handlers?.onLauncherSubmitGame?.({
              mode: 'edit',
              apiBase: data.apiBase,
              storyId: draft.storyId,
              name: draft.name,
              scheduledTime: draft.scheduledTime,
              locationText: draft.locationText,
              characterId: draft.characterId,
              gameId: editTarget?.id,
              hostKey: data.createdGame?.hostKey,
            })
          }}
        />
      ) : null}

      <section className="panel">
        {!displayedGames.length ? (
          <div className="empty-state">
            {user ? (
              <>
                <div>No games yet. Create your first game to get started!</div>
                <button
                  type="button"
                  className="btn btn--primary"
                  onClick={() => {
                    setEditMode('create')
                    setEditTarget(null)
                    setEditSheetOpen(true)
                  }}
                  style={{ marginTop: '1rem' }}
                >
                  Create Game
                </button>
              </>
            ) : (
              <>
                <div>Please sign in to view your game history.</div>
                <button
                  type="button"
                  className="action-btn action-btn--primary"
                  onClick={() => login()}
                  style={{ marginTop: '1rem' }}
                >
                  Sign In
                </button>
              </>
            )}
          </div>
        ) : (
          <>
            <div className="link-list">
              {displayedGames.map((g) => {
                const stateLabel = g.state ?? 'UNKNOWN'

                const title = g.name?.trim().length ? g.name.trim() : 'Untitled game'
                const story = g.storyId ? data.stories.find(s => s.id === g.storyId) : null
                const storyLine = story?.title?.trim().length ? story.title.trim() : ''
                const creatorLine = g.creatorName?.trim().length ? g.creatorName.trim() : ''
                const timeLabel = formatScheduledTime(g.scheduledTime)
                const locationLine = g.locationText?.trim().length ? g.locationText.trim() : ''
                const whenWhere = [locationLine, timeLabel].filter(Boolean).join(' · ')

                const joinedCharacters = g.joinedCharacters ?? []
                const isHost = !!g.hostKey
                const hasJoined = joinedCharacters.length > 0

                return (
                  <div key={g.id} className={`link-row ${story?.image ? 'link-row--has-image' : ''}`}>
                    {story?.image ? (
                      <div className="link-row__image">
                        <Media
                          src={story.image}
                          alt={`${story.title || 'Story'} thumbnail`}
                          variant="thumb"
                          ratio="1:1"
                          fit="cover"
                          fallback={{ type: 'gradient', label: story.title?.charAt(0) || 'S' }}
                        />
                      </div>
                    ) : null}
                    <div className="link-row__content">
                      <button
                        type="button"
                        className="link-row__title"
                        onClick={() => {
                          setActiveGame(g)
                          setSheetOpen(true)
                          handlers?.onLauncherOpenGameDetails?.(g.id, data.apiBase)
                        }}
                      >
                        <strong>{title}</strong>
                      </button>
                      <div className="link-row__meta">{stateLabel}</div>

                      {storyLine ? <div className="link-row__meta">{storyLine}</div> : null}
                      {creatorLine ? (
                        <div className="link-row__meta">
                          {g.creatorAvatar ? (
                            <img
                              src={g.creatorAvatar}
                              alt={`${creatorLine} avatar`}
                              style={{
                                width: 20,
                                height: 20,
                                borderRadius: '999px',
                                objectFit: 'cover',
                                display: 'inline-block',
                                verticalAlign: 'middle',
                                marginRight: 8,
                              }}
                            />
                          ) : null}
                          <span>{`Hosted by ${creatorLine}`}</span>
                        </div>
                      ) : null}
                      {whenWhere ? <div className="link-row__meta">{whenWhere}</div> : null}

                      <div className="link-row__actions">
                        {isHost && !hasJoined ? (
                          <button type="button" className="mini-btn" onClick={() => {
                            const hostUrl = `${window.location.origin}/host/${g.id}?hostKey=${g.hostKey}${data.apiBase ? `&api=${encodeURIComponent(data.apiBase)}` : ''}`
                            navigateInAppFromHref(hostUrl)
                          }}>
                            Rejoin Game
                          </button>
                        ) : null}
                        {joinedCharacters.map(char => {
                          const gameUrl = `${window.location.origin}/room/${g.id}/${char.characterId}${data.apiBase ? `?api=${encodeURIComponent(data.apiBase)}` : ''}`
                          const charName = char.characterName ?? 'Character'
                          return (
                            <button key={char.characterId} type="button" className="mini-btn" onClick={() => navigateInAppFromHref(gameUrl)}>
                              Rejoin as {charName}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {hasMoreGames && (
              <div className="u-mt-12 u-text-center">
                <button
                  type="button"
                  className="action-btn action-btn--secondary"
                  onClick={handleLoadMore}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading...' : 'Load more games'}
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </>
  )
}
