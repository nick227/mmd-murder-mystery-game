import { useEffect, useRef, useState } from 'react'
import type { LauncherData, RendererHandlers } from '../../../data/types'
import { navigateInAppFromHref } from '../../../app/inAppNavigation'
import { HostSetupSheet } from './HostSetupSheet'
import { mergeLauncherGames } from './mergeLauncherGames'
import { Media } from '../../ui/Media'
import { CreateEditGameSheet } from './CreateEditGameSheet'
import { useAuth } from '../../../hooks/useAuth'

type Game = ReturnType<typeof mergeLauncherGames>[0]

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

export function LauncherCard({ data, handlers }: { data: LauncherData; handlers?: RendererHandlers }) {
  const { user, isLoading, login } = useAuth()
  const [sheetOpen, setSheetOpen] = useState(false)
  const [activeGame, setActiveGame] = useState<Game | undefined>()
  const openedForGameIdRef = useRef<string | null>(null)
  const [editSheetOpen, setEditSheetOpen] = useState(false)
  const [editMode, setEditMode] = useState<'create' | 'edit'>('create')
  const [editTarget, setEditTarget] = useState<Game | null>(null)
  const [createStoryId, setCreateStoryId] = useState<string>('')
  const [authError, setAuthError] = useState('')
  const [authenticating, setAuthenticating] = useState(false)

  useEffect(() => {
    const cg = data.createdGame
    if (!cg || openedForGameIdRef.current === cg.id) return
    openedForGameIdRef.current = cg.id
    setActiveGame(undefined)
    setSheetOpen(true)
  }, [data.createdGame])

  const mergedGames = mergeLauncherGames(data)
  const editSheetStories =
    editMode === 'create' && createStoryId
      ? data.stories.filter(story => story.id === createStoryId)
      : data.stories

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <h2>Stories</h2>
        </div>
        {!data.stories.length ? (
          <div className="empty-state">Stories not loaded yet. Make sure the API is running.</div>
        ) : (
          <div className="story-picker">
            {data.stories.map(story => (
              <div key={story.id} className="story-option">
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
                <div className="story-option__content">
                  <strong>{story.title}</strong>
                  <span>{story.summary}</span>
                </div>
                <div className="launcher-actions u-mt-12">
                  <button
                    type="button"
                    className="action-btn action-btn--primary"
                    disabled={isLoading || authenticating}
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
      </section>

      {sheetOpen ? (
        <HostSetupSheet
          game={activeGame}
          createdGame={data.createdGame}
          apiBase={data.apiBase}
          stories={data.stories}
          publicGame={data.activeGamePublicKey && activeGame ? (data.activeGamePublicKey === `${activeGame.apiBase}:${activeGame.id}` ? data.activeGamePublic ?? null : null) : null}
          onClose={() => setSheetOpen(false)}
          onEditGame={g => {
            setEditMode('edit')
            setEditTarget(g)
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
              hostKey: editTarget?.access?.hostKey,
            })
          }}
        />
      ) : null}

      <section className="panel">
        {!mergedGames.length ? (
          <div className="empty-state">No games yet.</div>
        ) : (
          <div className="link-list">
            {mergedGames.map(g => {
              const stateLabel = g.state ?? (g.apiBase !== data.apiBase ? 'OTHER API' : 'UNKNOWN')
              const hostUrl = g.access?.hostKey
                ? `${window.location.origin}/host/${g.id}?hostKey=${g.access.hostKey}${g.apiBase ? `&api=${encodeURIComponent(g.apiBase)}` : ''}`
                : null

              const title = g.name?.trim().length ? g.name.trim() : 'Untitled game'
              const storyLine = g.storyTitle?.trim().length ? g.storyTitle.trim() : ''
              const creatorLine = g.creatorName?.trim().length ? g.creatorName.trim() : ''
              const timeLabel = formatScheduledTime(g.scheduledTime)
              const locationLine = g.locationText?.trim().length ? g.locationText.trim() : ''
              const whenWhere = [locationLine, timeLabel].filter(Boolean).join(' · ')

              return (
                <div key={`${g.apiBase}:${g.id}`} className={`link-row ${g.storyImage ? 'link-row--has-image' : ''}`}>
                  {g.storyImage ? (
                    <div className="link-row__image">
                      <Media
                        src={g.storyImage}
                        alt={`${g.storyTitle || 'Story'} thumbnail`}
                        variant="thumb"
                        ratio="1:1"
                        fit="cover"
                        fallback={{ type: 'gradient', label: g.storyTitle?.charAt(0) || 'S' }}
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
                        handlers?.onLauncherOpenGameDetails?.(g.id, g.apiBase)
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
                      {hostUrl ? (
                        <>
                          <button type="button" className="mini-btn" onClick={() => navigateInAppFromHref(hostUrl)}>
                            Open host
                          </button>
                          <button type="button" className="mini-btn" onClick={() => handlers?.onCopyText?.(hostUrl)}>
                            Copy host link
                          </button>
                        </>
                      ) : null}
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
