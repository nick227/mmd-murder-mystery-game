import type { ProfileCardItem, ScreenData } from '../../data/types'
import { initialsFromName } from '../../utils/uiText'
import { EmptyState } from '../ui/EmptyState'
import { Media } from '../ui/Media'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'
import { Surface } from '../ui/Surface'

interface Props {
  data: ScreenData
}

function ProfilePanel({ data }: { data: ScreenData['profile'] }) {
  const initials = initialsFromName(data.characterName)
  return (
    <Panel>
      <PanelHeader title={data.characterName} meta={data.archetype ?? 'Character'} />
      <div style={{ width: 72, height: 72, marginBottom: 10 }}>
        <Media
          kind="image"
          src={data.portrait}
          ratio="1:1"
          variant="thumb"
          fit="cover"
          priority={false}
          sizes="72px"
          role="avatar"
          alt={data.characterName}
          fallback={{ type: 'initials', label: initials }}
        />
      </div>
      <p className="profile-card__bio">{data.biography ?? 'No character details yet.'}</p>
    </Panel>
  )
}

function ProfileList({ title, items, emptyText }: { title: string; items: ProfileCardItem[]; emptyText: string }) {
  return (
    <Panel>
      <PanelHeader title={title} meta={String(items.length)} />
      {!items.length ? <EmptyState text={emptyText} /> : null}
      <div className="list-block">
        {items.map(item => (
          <div key={item.id} className="list-row">
            <div className="list-row__main">
              <div className="list-row__title">{item.label}</div>
              <div className="list-row__text">
                <span className="list-row__text-inner">{item.value}</span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

export function ProfileSurface({ data }: Props) {
  return (
    <Surface testId="surface-profile" surface="profile" dataUi="ProfileSurface">
      <ProfilePanel data={data.profile} />
      <ProfileList title="Secrets" items={data.profile.secrets} emptyText="No secrets yet." />
      <ProfileList title="Items" items={data.profile.items} emptyText="No items yet." />
    </Surface>
  )
}

