import { useMemo, useState } from 'react'
import type {
  ActionItem,
  ComposerData,
  GameState,
  JoinData,
  LauncherData,
  LayoutNode,
  ObjectiveItem,
  ProfileCardItem,
  RendererHandlers,
  RoomPlayer,
  ScreenData,
  StageData,
} from '../data/types'
import { Feed as FeedComponent } from './feed/Feed'
import { ComposerPanel } from './surfaces/ComposerPanel'
import { intentBadgeLabel } from '../utils/uiText'
import { BottomSheet } from './ui/BottomSheet'

// ── Bound value resolver ──────────────────────────────────────────────────────
// Supports top-level keys and one level of dot notation: "objectives.personal"

function getBoundValue(node: LayoutNode, data: ScreenData): unknown {
  if (!node.bind) return undefined
  const [top, sub] = node.bind.split('.')
  const topValue = data[top as keyof ScreenData]
  if (sub && topValue && typeof topValue === 'object') {
    return (topValue as Record<string, unknown>)[sub]
  }
  return topValue
}

// ── Player pills ──────────────────────────────────────────────────────────────

function PlayerPills({ players }: { players: RoomPlayer[] }) {
  if (!players.length) return null
  return (
    <div className="player-pills" aria-label="Players in room">
      {players.map((player, index) => (
        <div
          key={player.id}
          className={player.online ? 'player-pill player-pill--online' : 'player-pill'}
          data-testid={`player-pill-${player.characterId}`}
        >
          <span className="player-pill__name">{player.name}</span>
          <span className="player-pill__meta">{player.online ? 'in room' : 'not joined'}</span>
          <span
            data-testid={`player-pill-${index}`}
            style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}
          >
            {player.characterId}
          </span>
          {player.online ? (
            <span
              data-testid={`player-pill-joined-${index}`}
              style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}
            >
              joined
            </span>
          ) : null}
          {player.online ? (
            <span
              data-testid={`player-pill-joined-${player.characterId}`}
              style={{ position: 'absolute', left: -10000, width: 1, height: 1, overflow: 'hidden' }}
            >
              joined
            </span>
          ) : null}
        </div>
      ))}
    </div>
  )
}

// ── Stage ─────────────────────────────────────────────────────────────────────

export function Stage({ data, players, showPlayers = true }: { data: StageData; players: RoomPlayer[]; showPlayers?: boolean }) {
  const safePercent = typeof data.countdownPercent === 'number'
    ? Math.max(0, Math.min(100, data.countdownPercent))
    : null

  return (
    <section className="panel stage">
      <div
        className="stage__image"
        style={data.image
          ? { backgroundImage: `linear-gradient(rgba(11,16,32,.28), rgba(11,16,32,.88)), url(${data.image})` }
          : undefined}
      >
        <div className="stage__eyebrow" data-testid="stage-eyebrow">{data.state} · Act {data.act}</div>
        <h1 className="stage__title">{data.title}</h1>
        <p className="stage__subtitle">{data.subtitle}</p>
        {data.countdownLabel ? <div className="countdown-pill">{data.countdownLabel}</div> : null}
      </div>
      {safePercent !== null ? (
        <div className="progress-strip">
          <div className="progress-strip__bar" style={{ width: `${safePercent}%` }} />
        </div>
      ) : null}
      {data.banner ? <div className="banner">{data.banner}</div> : null}
      <p className="stage__description">{data.description}</p>
      {showPlayers ? <PlayerPills players={players} /> : null}
    </section>
  )
}

// ── List (objectives + profile card items) ────────────────────────────────────

function ObjectiveList({
  items,
  emptyText,
  handlers,
}: {
  items: ObjectiveItem[] | ProfileCardItem[]
  emptyText?: string
  handlers?: RendererHandlers
}) {
  if (!items.length) return <div className="empty-state">{emptyText ?? 'Nothing here yet.'}</div>

  const textsById = useMemo(() => {
    const map = new Map<string, string>()
    for (const item of items) {
      const raw = 'value' in item ? item.value : item.text
      map.set(item.id, String(raw ?? ''))
    }
    return map
  }, [items])

  const [expandedById, setExpandedById] = useState<Record<string, boolean>>({})
  const [submittingById, setSubmittingById] = useState<Record<string, boolean>>({})
  const [flashById, setFlashById] = useState<Record<string, boolean>>({})

  const isObjectiveList = items.every(item => 'completed' in item)
  const objectiveItems = (isObjectiveList ? (items as ObjectiveItem[]) : [])

  const isInstructionObjectives =
    isObjectiveList
    && objectiveItems.length > 0
    && objectiveItems.every(i => !i.group)
    && objectiveItems.some(i => i.intent === 'instruction' || !i.intent)

  const intentRank: Record<string, number> = {
    reveal: 0,
    puzzle: 1,
    clue: 2,
    instruction: 3,
    info: 4,
    '': 5,
  }

  const orderedItems: Array<ObjectiveItem | ProfileCardItem> = useMemo(() => {
    if (!isObjectiveList) return items
    // Only sort "group/new this act" style lists (group flag set).
    const hasGroup = objectiveItems.some(i => Boolean(i.group))
    if (!hasGroup) return items
    const cloned = [...objectiveItems]
    cloned.sort((a, b) => (intentRank[String(a.intent ?? '')] ?? 99) - (intentRank[String(b.intent ?? '')] ?? 99))
    return cloned
  }, [items, isObjectiveList])

  const renderRows = (rows: Array<ObjectiveItem | ProfileCardItem>) => (
    <>
      {rows.map(item => {
        const isObjective = 'completed' in item
        const text = textsById.get(item.id) ?? ''
        const isLong = text.length > 220 || text.split('\n').length > 4
        const expanded = Boolean(expandedById[item.id])
        const submitting = Boolean(submittingById[item.id])
        const intent = isObjective && 'intent' in item ? String((item as any).intent ?? '') : ''
        const isReveal = isObjective && intent === 'reveal'

        return (
          <div
            key={item.id}
            className={[
              'list-row',
              isObjective && item.completed ? 'list-row--complete' : '',
              flashById[item.id] ? 'list-row--flash' : '',
            ].filter(Boolean).join(' ')}
            data-testid={isObjective ? 'card' : undefined}
            data-intent={isObjective ? intent : undefined}
          >
            <div className="list-row__main">
              {'label' in item ? <div className="list-row__title">{item.label}</div> : null}
              {isObjective && intent ? (
                <div className="list-row__meta">
                  <span className={`badge badge--intent badge--intent-${intent}`}>{intentBadgeLabel(intent as ObjectiveItem['intent'])}</span>
                </div>
              ) : null}
              <div className={expanded ? 'list-row__text list-row__text--expanded' : 'list-row__text'}>
                <span className="list-row__text-inner">{text}</span>
              </div>
              {isLong ? (
                <button
                  type="button"
                  className="mini-btn list-row__more"
                  onClick={() => setExpandedById(current => ({ ...current, [item.id]: !expanded }))}
                >
                  {expanded ? 'Show less' : 'Read more'}
                </button>
              ) : null}
            </div>
            {isObjective ? (
              <div className="list-row__action">
                {isReveal ? <div className="badge badge--new">New</div> : null}
                <button
                  type="button"
                  disabled={submitting}
                  className={item.completed ? 'check-button check-button--checked' : 'check-button'}
                  data-testid={`objective-toggle:${item.id}`}
                  onClick={async () => {
                    const submit = handlers?.onObjectiveSubmit
                    const toggle = handlers?.onObjectiveToggle
                    if (!submit && !toggle) return

                    setSubmittingById(current => ({ ...current, [item.id]: true }))
                    try {
                      if (submit) {
                        await submit(item.id)
                      } else {
                        toggle?.(item.id)
                      }
                      setFlashById(current => ({ ...current, [item.id]: true }))
                      window.setTimeout(() => {
                        setFlashById(current => ({ ...current, [item.id]: false }))
                      }, 650)
                    } finally {
                      setSubmittingById(current => ({ ...current, [item.id]: false }))
                    }
                  }}
                >
                  {submitting ? 'Submitting…' : item.completed ? 'Submitted' : 'Submit'}
                </button>
                <div className="list-row__helper">Posts to the room feed.</div>
              </div>
            ) : null}
          </div>
        )
      })}
    </>
  )

  return (
    <div className="list-block" data-testid="list-block">
      {isInstructionObjectives ? (
        <>
          <div className="list-block__section-title">Do now</div>
          {renderRows(objectiveItems.filter(i => !i.completed))}
          <div className="list-block__section-title">Submitted</div>
          {renderRows(objectiveItems.filter(i => i.completed))}
        </>
      ) : (
        renderRows(orderedItems)
      )}
    </div>
  )
}

// ── Actions bar ───────────────────────────────────────────────────────────────

function ActionsBar({ items, handlers }: { items: ActionItem[]; handlers?: RendererHandlers }) {
  if (!items.length) return null
  return (
    <div className="actions-bar" data-testid="actions-bar">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          disabled={item.disabled}
          className={`action-btn action-btn--${item.kind ?? 'secondary'}`}
          data-testid={`action:${item.id}`}
          onClick={() => handlers?.onAction?.(item.id)}
        >
          {item.label}
        </button>
      ))}
    </div>
  )
}

// ── Profile card ──────────────────────────────────────────────────────────────

function ProfileCard({ data }: { data: ScreenData['profile'] }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>{data.characterName}</h2>
        <div className="panel__meta">{data.archetype ?? 'Character'}</div>
      </div>
      <p className="profile-card__bio">{data.biography ?? 'No character details yet.'}</p>
    </section>
  )
}

// ── Host info card ────────────────────────────────────────────────────────────

function HostInfoCard({ data, handlers }: { data: NonNullable<ScreenData['hostInfo']>; handlers?: RendererHandlers }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Game info</h2>
        <div className="panel__meta">Host only</div>
      </div>
      <div className="meta-grid">
        <div><strong>Game</strong><span>{data.storyTitle}</span></div>
        <div><strong>Time</strong><span>{new Date(data.scheduledTime).toLocaleString()}</span></div>
        <div><strong>Location</strong><span>{data.locationText ?? 'TBD'}</span></div>
        <div><strong>Game ID</strong><span>{data.gameId}</span></div>
      </div>
      <div className="link-list" style={{ marginTop: 12 }}>
        {data.playerLinks.map(link => (
          <div key={link.characterId} className="link-row">
            <strong>{link.label}</strong>
            <div className="link-row__meta">{link.joined ? 'joined' : 'waiting'}</div>
            <code>{link.url}</code>
            <div className="link-row__actions">
              <button type="button" className="mini-btn" onClick={() => handlers?.onCopyText?.(link.url)}>
                Copy link
              </button>
              <button
                type="button"
                className="mini-btn"
                onClick={() => (window.location.href = `${window.location.origin}/room/${data.gameId}/${link.characterId}?hostKey=${encodeURIComponent(data.hostKey)}`)}
              >
                Play as
              </button>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Launcher card ─────────────────────────────────────────────────────────────

function LauncherCard({ data, handlers }: { data: LauncherData; handlers?: RendererHandlers }) {
  const [showHostSetup, setShowHostSetup] = useState(false)
  const [setupCharacterId, setSetupCharacterId] = useState<string | null>(null)
  const [setupScheduledTime, setSetupScheduledTime] = useState<string>('')

  // Open the host setup sheet right after creation.
  if (data.createdGame && !showHostSetup && !setupScheduledTime) {
    setShowHostSetup(true)
    setSetupScheduledTime(data.createdGame.scheduledTime.slice(0, 16))
    setSetupCharacterId(data.createdGame.playerLinks[0]?.characterId ?? null)
  }

  const gamesByKey = new Map<string, {
    id: string
    apiBase: string
    name?: string
    state?: GameState
    scheduledTime?: string
    lastSeenAt?: string
    access?: { hostKey?: string; characterIds: string[] }
  }>()

  for (const g of data.allGames) {
    const key = `${data.apiBase}:${g.id}`
    gamesByKey.set(key, {
      id: g.id,
      apiBase: data.apiBase,
      name: g.name,
      state: g.state,
      scheduledTime: g.scheduledTime,
      access: { characterIds: [] },
    })
  }

  for (const saved of data.savedGames) {
    const key = `${saved.apiBase}:${saved.gameId}`
    const existing = gamesByKey.get(key)
    gamesByKey.set(key, {
      id: saved.gameId,
      apiBase: saved.apiBase,
      name: existing?.name,
      state: existing?.state,
      scheduledTime: existing?.scheduledTime,
      lastSeenAt: saved.lastSeenAt,
      access: {
        hostKey: saved.hostKey,
        characterIds: saved.characterIds,
      },
    })
  }

  const mergedGames = Array.from(gamesByKey.values()).sort((a, b) => {
    const aKey = a.lastSeenAt ?? a.scheduledTime ?? ''
    const bKey = b.lastSeenAt ?? b.scheduledTime ?? ''
    return bKey.localeCompare(aKey) || a.id.localeCompare(b.id)
  })

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
        <div className="story-picker" style={{ marginTop: 12 }}>
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
        <div className="field-grid" style={{ marginTop: 12 }}>
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
        <div className="launcher-actions" style={{ marginTop: 12 }}>
          <button type="button" className="action-btn action-btn--primary" onClick={() => handlers?.onCreateGame?.()}>
            Create game
          </button>
        </div>
        {data.createdGame ? (
          <div className="created-box" style={{ marginTop: 12 }}>
            <strong>{data.createdGame.name}</strong>
            <code style={{ display: 'block', marginTop: 6 }}>{data.createdGame.hostUrl}</code>
            <div className="link-row__actions link-row__actions--stack" style={{ marginTop: 8 }}>
              <button type="button" className="mini-btn" onClick={() => handlers?.onCopyText?.(data.createdGame!.hostUrl)}>
                Copy host link
              </button>
            </div>
            {data.createdGame.playerLinks.map(link => (
              <div key={link.url} className="link-row" style={{ marginTop: 10 }}>
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
        <BottomSheet
          open={true}
          onClose={() => setShowHostSetup(false)}
          eyebrow="Host setup"
          title="Enter the room"
          meta="Pick who you’re playing and when to start"
        >
          <div className="field-grid">
            <div className="field">
              <label className="field__label">Scheduled time</label>
              <input
                className="field__input"
                type="datetime-local"
                value={setupScheduledTime}
                onChange={e => setSetupScheduledTime(e.target.value)}
              />
            </div>
          </div>

          <div className="story-picker" style={{ marginTop: 12 }}>
            <div className="field__label">Play as</div>
            {data.createdGame.playerLinks.map(link => (
              <button
                key={link.characterId}
                type="button"
                className={setupCharacterId === link.characterId ? 'story-option story-option--active' : 'story-option'}
                onClick={() => setSetupCharacterId(link.characterId)}
              >
                <strong>{link.label}</strong>
                <span>{link.characterId}</span>
              </button>
            ))}
          </div>

          <div className="launcher-actions" style={{ marginTop: 12 }}>
            <button
              type="button"
              className="action-btn action-btn--primary"
              onClick={async () => {
                const gameId = data.createdGame!.id
                const hostKey = data.createdGame!.hostKey
                const characterId = setupCharacterId ?? data.createdGame!.playerLinks[0]!.characterId
                const scheduledIso = new Date(setupScheduledTime).toISOString()
                await handlers?.onRescheduleGame?.(gameId, hostKey, scheduledIso)
                const query = new URLSearchParams()
                query.set('hostKey', hostKey)
                if (data.apiBase) query.set('api', data.apiBase)
                window.location.href = `/room/${gameId}/${characterId}?${query.toString()}`
              }}
            >
              Enter room
            </button>
          </div>
        </BottomSheet>
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
                    <div className="link-list" style={{ marginTop: 10 }}>
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

// ── Join card ─────────────────────────────────────────────────────────────────

function JoinCard({ data, handlers }: { data: JoinData; handlers?: RendererHandlers }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>{data.title}</h2>
        <div className="panel__meta">Pregame room</div>
      </div>
      <p className="profile-card__bio">{data.subtitle}</p>
      <div className="field-grid" style={{ marginTop: 12 }}>
        <div className="field">
          <label className="field__label">Your name</label>
          <input
            className="field__input"
            value={data.playerName}
            placeholder="Enter your name"
            data-testid="join-name"
            autoFocus
            onChange={e => handlers?.onJoinNameChange?.(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter') handlers?.onJoinSubmit?.()
            }}
          />
        </div>
      </div>
      <div className="launcher-actions" style={{ marginTop: 12 }}>
        <button type="button" className="action-btn action-btn--primary" data-testid="join-submit" onClick={() => handlers?.onJoinSubmit?.()}>
          {data.submitLabel}
        </button>
      </div>
    </section>
  )
}

// ── RenderNode — the declarative renderer ─────────────────────────────────────
// Matches the v5 ScreenData shape and LayoutNode type union from types.ts

export function RenderNode({ node, data, handlers }: {
  node: LayoutNode
  data: ScreenData
  handlers?: RendererHandlers
}) {
  const value = getBoundValue(node, data)

  switch (node.type) {
    case 'stage':
      return <Stage data={(value as StageData) ?? data.game} players={data.players} />

    case 'feed':
      return <FeedComponent items={(value as ScreenData['feed']) ?? data.feed} />

    case 'list':
      return (
        <ObjectiveList
          items={(value as ObjectiveItem[] | ProfileCardItem[]) ?? []}
          emptyText={node.emptyText}
          handlers={handlers}
        />
      )

    case 'actions':
      return <ActionsBar items={(value as ActionItem[]) ?? []} handlers={handlers} />

    case 'profile-card':
      return <ProfileCard data={(value as ScreenData['profile']) ?? data.profile} />

    case 'host-info': {
      const hostInfo = (value as ScreenData['hostInfo']) ?? data.hostInfo
      return hostInfo ? <HostInfoCard data={hostInfo} handlers={handlers} /> : null
    }

    case 'composer': {
      const composer = (value as ComposerData) ?? data.composer
      return <ComposerPanel data={composer} handlers={handlers} />
    }

    case 'launcher': {
      const launcher = (value as LauncherData) ?? data.launcher
      return launcher ? <LauncherCard data={launcher} handlers={handlers} /> : null
    }

    case 'join-card': {
      const join = (value as JoinData) ?? data.join
      return join ? <JoinCard data={join} handlers={handlers} /> : null
    }

    case 'section':
      return (
        <section className="panel">
          {node.title
            ? <div className="panel__header"><h2>{node.title}</h2></div>
            : null}
          <div className="section-stack">
            {node.children?.map(child => (
              <RenderNode key={child.id} node={child} data={data} handlers={handlers} />
            ))}
          </div>
        </section>
      )

    default:
      return null
  }
}
