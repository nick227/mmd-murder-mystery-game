import type { ProfileCardItem } from '../../../data/types'
import type { PlayerProfileTemplateProps } from './playerTemplateProps'
import { initialsFromName } from '../../../utils/uiText'
import { EmptyState } from '../../ui/EmptyState'
import { Media } from '../../ui/Media'
import { Panel } from '../../ui/Panel'
import { PanelHeader } from '../../ui/PanelHeader'
import { Surface } from '../../ui/Surface'
import { ui } from '../../../utils/uiMarkers'

function ProfilePanel({ data }: { data: PlayerProfileTemplateProps['profile'] }) {
  const initials = initialsFromName(data.characterName)
  return (
    <Panel>
      <PanelHeader title={data.characterName} meta={data.archetype ?? 'Character'} />
      <div style={{ width: '100%', marginBottom: 10 }}>
        <Media
          kind="image"
          src={data.portrait}
          ratio="16:9"
          variant="hero"
          fit="cover"
          priority={false}
          sizes="100vw"
          role="content"
          alt={data.characterName}
          fallback={{ type: 'initials', label: initials }}
        />
      </div>
      <p className="profile-card__bio">{data.biography ?? 'No character details yet.'}</p>
    </Panel>
  )
}

function ProfileList({ title, items, emptyText }: { title: string; items: ProfileCardItem[]; emptyText: string }) {
  const imageFromItem = (item: ProfileCardItem): string | undefined => {
    const anyItem = item as unknown as {
      image?: unknown
      image_url?: unknown
      imageUrl?: unknown
      card_image?: unknown
    }
    const candidates = [anyItem.image, anyItem.image_url, anyItem.imageUrl, anyItem.card_image]
    for (const candidate of candidates) {
      if (typeof candidate === 'string' && candidate.trim().length > 0) return candidate.trim()
    }
    return undefined
  }

  return (
    <Panel>
      <PanelHeader title={title} meta={String(items.length)} />
      {!items.length ? <EmptyState text={emptyText} /> : null}
      <div className="list-block">
        {items.map(item => (
          <div
            key={item.id}
            className={[
              'list-row',
              imageFromItem(item) ? 'list-row--with-thumb' : '',
            ].filter(Boolean).join(' ')}
          >
            {imageFromItem(item) ? (
              <div className="list-row__thumb">
                <Media
                  kind="image"
                  src={imageFromItem(item)}
                  alt={`${title}: ${item.label}`}
                  ratio="1:1"
                  variant="card"
                  fit="cover"
                  priority={false}
                  sizes="(max-width: 768px) 96px, 140px"
                  role="decorative"
                  fallback={{ type: 'icon', label: title }}
                />
              </div>
            ) : null}
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

export function PlayerProfileTemplate({ profile, embedded }: PlayerProfileTemplateProps) {
  const body = (
    <>
      <ProfilePanel data={profile} />
      <ProfileList title="Secrets" items={profile.secrets} emptyText="No secrets yet." />
      <ProfileList title="Items" items={profile.items} emptyText="No items yet." />
    </>
  )
  if (embedded) {
    return (
      <section
        className="lobby-stack surface surface--profile"
        data-testid="lobby-profile"
        {...ui('ProfileSurface')}
      >
        {body}
      </section>
    )
  }
  return (
    <Surface testId="surface-profile" surface="profile" dataUi="ProfileSurface">
      {body}
    </Surface>
  )
}
