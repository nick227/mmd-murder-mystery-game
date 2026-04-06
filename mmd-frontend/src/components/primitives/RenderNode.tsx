import type {
  ActionItem,
  ComposerData,
  LauncherData,
  LayoutNode,
  ObjectiveItem,
  ProfileCardItem,
  RendererHandlers,
  ScreenData,
  StageData,
} from '../../data/types'
import { Feed as FeedComponent } from '../feed/Feed'
import { ComposerPanel } from '../surfaces/ComposerPanel'
import { ActionsBar } from './ActionsBar'
import { Card } from './Card'
import { getBoundValue } from './getBoundValue'
import { LauncherCard } from './launcher/LauncherCard'
import { List } from './List'
import { Stage } from './Stage'

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
        <List
          className={node.id}
          items={(value as ObjectiveItem[] | ProfileCardItem[]) ?? []}
          emptyText={node.emptyText}
          handlers={handlers}
        />
      )

    case 'actions':
      return <ActionsBar items={(value as ActionItem[]) ?? []} handlers={handlers} />

    case 'profile-card': {
      const profile = (value as ScreenData['profile']) ?? data.profile
      return (
        <Card title={profile.characterName} meta={profile.archetype ?? 'Character'} className="profile-card">
          <p className="profile-card__bio">{profile.biography ?? 'No character details yet.'}</p>
        </Card>
      )
    }

    case 'host-info': {
      const hostInfo = (value as ScreenData['hostInfo']) ?? data.hostInfo
      if (!hostInfo) return null
      return (
        <Card title="Game info" meta="Host only" className="host-info-card">
          <div className="meta-grid">
            <div><strong>Game</strong><span>{hostInfo.storyTitle}</span></div>
            <div><strong>Time</strong><span>{new Date(hostInfo.scheduledTime).toLocaleString()}</span></div>
            <div><strong>Location</strong><span>{hostInfo.locationText ?? 'TBD'}</span></div>
            <div><strong>Game ID</strong><span>{hostInfo.gameId}</span></div>
          </div>
          <div className="link-list u-mt-12">
            {hostInfo.playerLinks.map(link => (
              <div key={link.characterId} className="link-row">
                <div className="link-row__label">
                  <span>{link.label}</span>
                  &nbsp;-&nbsp;
                  <span className={`status-badge ${link.joined ? 'status-badge--online' : 'status-badge--offline'}`}>
                     {link.joined ? 'online' : 'waiting'}
                  </span>
                </div>
                <div className="link-row__actions">
                  <button title="Click to copy link" type="button" className="mini-btn action-btn action-btn--secondary" onClick={() => handlers?.onCopyText?.(link.url)}>
                    <code className="truncate">{link.url}</code>
                  </button>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )
    }

    case 'composer': {
      const composer = (value as ComposerData) ?? data.composer
      return <ComposerPanel data={composer} handlers={handlers} />
    }

    case 'launcher': {
      const launcher = (value as LauncherData) ?? data.launcher
      return launcher ? <LauncherCard data={launcher} handlers={handlers} /> : null
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
