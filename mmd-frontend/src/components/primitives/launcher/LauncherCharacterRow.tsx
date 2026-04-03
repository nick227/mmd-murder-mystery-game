import { Media } from '../../ui/Media'

export function LauncherCharacterRow({
  label,
  portrait,
  active,
  onClick,
}: {
  label: string
  portrait?: string
  active?: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      className={active ? 'story-option story-option--active story-option--row' : 'story-option story-option--row'}
      onClick={onClick}
    >
      <div className="story-option__thumb">
        <Media
          src={portrait}
          alt={`${label} portrait`}
          variant="thumb"
          ratio="1:1"
          fit="cover"
          fallback={{ type: 'initials', label }}
        />
      </div>
      <strong className="truncate">{label}</strong>
    </button>
  )
}

