import type { StoryListItem } from '../../../data/types'
import { Media } from '../../ui/Media'

export function LauncherStoryCard({
  story,
  active,
  onClick,
}: {
  story: Pick<StoryListItem, 'id' | 'title' | 'summary' | 'image'>
  active?: boolean
  onClick?: () => void
}) {
  const className = active ? 'story-option story-option--active' : 'story-option'
  const content = (
    <>
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
    </>
  )

  if (onClick) {
    return (
      <button type="button" className={className} onClick={onClick}>
        {content}
      </button>
    )
  }

  return <div className={className}>{content}</div>
}

