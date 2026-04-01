import { useEffect, useRef, useState } from 'react'
import type { LauncherData, RendererHandlers } from '../../../data/types'
import { HostSetupSheet } from './HostSetupSheet'
import { mergeLauncherGames } from './mergeLauncherGames'

export function LauncherCard({ data, handlers }: { data: LauncherData; handlers?: RendererHandlers }) {
  const [showHostSetup, setShowHostSetup] = useState(false)
  const [setupCharacterId, setSetupCharacterId] = useState<string | null>(null)
  const [setupScheduledTime, setSetupScheduledTime] = useState('')
  const openedForGameIdRef = useRef<string | null>(null)

  useEffect(() => {
    const cg = data.createdGame
    if (!cg || openedForGameIdRef.current === cg.id) return
    openedForGameIdRef.current = cg.id
    setShowHostSetup(true)
    setSetupScheduledTime(cg.scheduledTime.slice(0, 16))
    setSetupCharacterId(cg.playerLinks[0]?.characterId ?? null)
  }, [data.createdGame])

  const mergedGames = mergeLauncherGames(data)

  return (
    <>
      <section className="panel">
        <div className="panel__header">
          <h2>Playtest launcher</h2>
          <div className="panel__meta">Create a scheduled game</div>
        </div>
        <div className="field-grid">
          <div className="field">
            <label className="field__label">API base</label>
            <input
              className="field__input"
              value={data.apiBase}
              placeholder="http://localhost:3000"
              onChange={e => handlers?.onLauncherFieldChange?.('apiBase', e.target.value)}
            />
          </div>
        </div>
        <div className="story-picker u-mt-12">
          <div className="field__label">Story</div>
          {!data.stories.length
            ? <div className="empty-state">No stories loaded yet. Check API base and reload.</div>
            : null}
          {data.stories.map(story => (
            <button
              key={story.id}
              type="button"
              className={data.form.storyId === story.id ? 'story-option story-option--active' : 'story-option'}
              onClick={() => handlers?.onLauncherFieldChange?.('storyId', story.id)}
            >
              <strong>{story.title}</strong>
              <span>{story.summary}</span>
            </button>
          ))}
        </div>
        <div className="field-grid u-mt-12">
          <div className="field">
            <label className="field__label">Game name</label>
            <input className="field__input" value={data.form.name} onChange={e => handlers?.onLauncherFieldChange?.('name', e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Scheduled time</label>
            <input className="field__input" type="datetime-local" value={data.form.scheduledTime} onChange={e => handlers?.onLauncherFieldChange?.('scheduledTime', e.target.value)} />
          </div>
          <div className="field">
            <label className="field__label">Location</label>
            <input className="field__input" value={data.form.locationText} onChange={e => handlers?.onLauncherFieldChange?.('locationText', e.target.value)} />
          </div>
        </div>
        <div className="launcher-actions u-mt-12">
          <button type="button" className="action-btn action-btn--primary" data-action="start" onClick={() => handlers?.onCreateGame?.()}>
            Create game
          </button>
        </div>
        {data.createdGame ? (
          <div className="created-box u-mt-12">
            <strong>{data.createdGame.name}</strong>
            <code>{data.createdGame.hostUrl}</code>
            <div className="link-row__actions link-row__actions--stack u-mt-8">
              <button type="button" className="mini-btn" onClick={() => handlers?.onCopyText?.(data.createdGame!.hostUrl)}>
                Copy host link
              </button>
            </div>
            {data.createdGame.playerLinks.map(link => (
              <div key={link.url} className="link-row u-mt-10">
                <strong>{link.label}</strong>
                <code>{link.url}</code>
                <div className="link-row__actions">
                  <button type="button" className="mini-btn" onClick={() => handlers?.onCopyText?.(link.url)}>
                    Copy link
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>

      {data.createdGame && showHostSetup ? (
        <HostSetupSheet
          createdGame={data.createdGame}
          apiBase={data.apiBase}
          setupScheduledTime={setupScheduledTime}
          setupCharacterId={setupCharacterId}
          onScheduledTimeChange={setSetupScheduledTime}
          onCharacterIdChange={setSetupCharacterId}
          onClose={() => setShowHostSetup(false)}
          handlers={handlers}
        />
      ) : null}

      <section className="panel">
        <div className="panel__header">
          <h2>Games</h2>
          <div className="panel__meta">Public + saved access</div>
        </div>
        {!mergedGames.length ? (
          <div className="empty-state">No games yet.</div>
        ) : (
          <div className="link-list">
            {mergedGames.map(g => {
              const stateLabel = g.state ?? (g.apiBase !== data.apiBase ? 'OTHER API' : 'UNKNOWN')
              const hostUrl = g.access?.hostKey
                ? `${window.location.origin}/host/${g.id}?hostKey=${g.access.hostKey}${g.apiBase ? `&api=${encodeURIComponent(g.apiBase)}` : ''}`
                : null

              return (
                <div key={`${g.apiBase}:${g.id}`} className="link-row">
                  <strong>{g.name ?? g.id}</strong>
                  <div className="link-row__meta">{stateLabel}</div>
                  <code>{g.id}</code>

                  {g.apiBase !== data.apiBase ? (
                    <div className="link-row__meta">{g.apiBase}</div>
                  ) : null}

                  <div className="link-row__actions">
                    {hostUrl ? (
                      <>
                        <button type="button" className="mini-btn" onClick={() => (window.location.href = hostUrl)}>
                          Open host
                        </button>
                        <button type="button" className="mini-btn" onClick={() => handlers?.onCopyText?.(hostUrl)}>
                          Copy host link
                        </button>
                        <button type="button" className="mini-btn" onClick={() => handlers?.onCancelGame?.(g.id, g.access!.hostKey!)}>
                          Cancel game
                        </button>
                      </>
                    ) : null}
                  </div>

                  {Array.isArray(g.access?.characterIds) && g.access!.characterIds.length ? (
                    <div className="link-list u-mt-10">
                      {g.access!.characterIds.map(characterId => {
                        const url = `${window.location.origin}/play/${g.id}/${characterId}${g.apiBase ? `?api=${encodeURIComponent(g.apiBase)}` : ''}`
                        return (
                          <div key={characterId} className="link-row">
                            <strong>{`Player ${characterId}`}</strong>
                            <code>{url}</code>
                            <div className="link-row__actions">
                              <button type="button" className="mini-btn" onClick={() => handlers?.onCopyText?.(url)}>
                                Copy link
                              </button>
                              <button type="button" className="mini-btn" onClick={() => (window.location.href = url)}>
                                Open
                              </button>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  ) : null}
                </div>
              )
            })}
          </div>
        )}
      </section>
    </>
  )
}
