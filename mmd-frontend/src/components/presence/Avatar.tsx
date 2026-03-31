import { Media } from '../ui/Media'
import { initialsFromName } from '../../utils/uiText'

interface Props {
  name: string
  online: boolean
  size?: 'sm' | 'md' | 'lg'
  src?: string
}

export function Avatar({ name, online, size = 'md', src }: Props) {
  const initials = initialsFromName(name)
  const px = size === 'sm' ? 28 : size === 'lg' ? 44 : 36

  return (
    <div
      className={online ? 'avatar avatar--online' : 'avatar'}
      aria-label={online ? `${name} (online)` : `${name} (offline)`}
      data-testid="avatar"
      style={{ width: px, height: px }}
    >
      <Media
        kind="image"
        src={src}
        alt={name}
        ratio="1:1"
        variant="thumb"
        fit="cover"
        priority={false}
        sizes={`${px}px`}
        role="avatar"
        fallback={{ type: 'initials', label: initials }}
      />
    </div>
  )
}

