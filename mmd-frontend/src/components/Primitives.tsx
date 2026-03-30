import type {
  ActionItem,
  ComposerData,
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
      {players.map(player => (
        <div key={player.id} className={player.online ? 'player-pill player-pill--online' : 'player-pill'}>
          <span className="player-pill__name">{player.name}</span>
          <span className="player-pill__meta">{player.online ? 'in room' : 'not joined'}</span>
        </div>
      ))}
    </div>
  )
}

// ── Stage ─────────────────────────────────────────────────────────────────────

export function Stage({ data, players }: { data: StageData; players: RoomPlayer[] }) {
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
        <div className="stage__eyebrow">{data.state} · Act {data.act}</div>
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
      <PlayerPills players={players} />
    </section>
  )
}

// ── Feed ──────────────────────────────────────────────────────────────────────

function Feed({ items }: { items: ScreenData['feed'] }) {
  return (
    <section className="panel">
      <div className="panel__header">
        <h2>Room feed</h2>
        <div className="panel__meta">Live room updates</div>
      </div>
      <div className="feed-list">
        {!items.length ? <div className="empty-state">No room updates yet.</div> : null}
        {items.map(item => (
          <article key={item.id} className={`feed-item feed-item--${item.type}`}>
            <div className="feed-item__top">
              <span>{item.author ?? item.type}</span>
              <span>{item.timestamp ?? ''}</span>
            </div>
            {item.visibility ? <div className="feed-item__visibility">{item.visibility}</div> : null}
            <div>{item.text}</div>
          </article>
        ))}
      </div>
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
  return (
    <div className="list-block">
      {items.map(item => {
        const isObjective = 'completed' in item
        return (
          <div key={item.id} className={isObjective && item.completed ? 'list-row list-row--complete' : 'list-row'}>
            <div className="list-row__main">
              {'label' in item ? <div className="list-row__title">{item.label}</div> : null}
              <div className="list-row__text">{'value' in item ? item.value : item.text}</div>
            </div>
            {isObjective ? (
              <button
                type="button"
                className={item.completed ? 'check-button check-button--checked' : 'check-button'}
                onClick={() => handlers?.onObjectiveToggle?.(item.id)}
              >
                {item.completed ? 'Done' : 'Mark done'}
              </button>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}

// ── Actions bar ───────────────────────────────────────────────────────────────

function ActionsBar({ items, handlers }: { items: ActionItem[]; handlers?: RendererHandlers }) {
  if (!items.length) return null
  return (
    <div className="actions-bar">
      {items.map(item => (
        <button
          key={item.id}
          type="button"
          disabled={item.disabled}
          className={`action-btn action-btn--${item.kind ?? 'secondary'}`}
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
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

// ── Composer card ─────────────────────────────────────────────────────────────

function ComposerCard({ data, handlers }: { data: ComposerData; handlers?: RendererHandlers }) {
  return (
    <section className="panel composer-panel">
      <div className="panel__header">
        <h2>Messages</h2>
        <div className="panel__meta">Public and private</div>
      </div>
      <div className="composer-toggle">
        <button
          type="button"
          className={data.mode === 'public' ? 'mini-btn mini-btn--active' : 'mini-btn'}
          onClick={() => handlers?.onComposerModeChange?.('public')}
        >
          Public
        </button>
        <button
          type="button"
          className={data.mode === 'private' ? 'mini-btn mini-btn--active' : 'mini-btn'}
          onClick={() => handlers?.onComposerModeChange?.('private')}
        >
          Private
        </button>
      </div>
      {data.mode === 'private' ? (
        <select
          className="composer-select"
          value={data.recipientId ?? ''}
          onChange={e => handlers?.onComposerRecipientChange?.(e.target.value)}
        >
          <option value="">Choose recipient</option>
          {data.recipients.map(r => (
            <option key={r.id} value={r.id}>{r.label}</option>
          ))}
        </select>
      ) : null}
      <textarea
        className="composer-textarea"
        placeholder={data.placeholder}
        value={data.draft}
        onChange={e => handlers?.onComposerDraftChange?.(e.target.value)}
      />
      <div className="composer-actions">
        <button
          type="button"
          className="action-btn action-btn--primary"
          disabled={!data.canSend}
          onClick={() => handlers?.onComposerSend?.()}
        >
          Send
        </button>
      </div>
    </section>
  )
}

// ── Launcher card ─────────────────────────────────────────────────────────────

function LauncherCard({ data, handlers }: { data: LauncherData; handlers?: RendererHandlers }) {
  return (
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
            onChange={e => handlers?.onJoinNameChange?.(e.target.value)}
          />
        </div>
      </div>
      <div className="launcher-actions" style={{ marginTop: 12 }}>
        <button type="button" className="action-btn action-btn--primary" onClick={() => handlers?.onJoinSubmit?.()}>
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
      return <Feed items={(value as ScreenData['feed']) ?? data.feed} />

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
      return <ComposerCard data={composer} handlers={handlers} />
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
