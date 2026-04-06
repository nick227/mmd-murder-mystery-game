import type { RoomPlayer, StageData } from '../../data/types'
import { Media } from '../ui/Media'

type StageDisplayMode = 'story' | 'act'

export function Stage({
  data,
  showDescription = true,
  display = 'story',
}: {
  data: StageData
  players: RoomPlayer[]
  showPlayers?: boolean
  showDescription?: boolean
  display?: StageDisplayMode
}) {
  const isActView = display === 'act'
  const primaryTitle = isActView ? data.title : (data.storyTitle ?? data.title)
  const secondaryTitle = undefined
  const actBody = (data.actText ?? '').trim() ? (data.actText ?? '') : data.description
  const bodyText = isActView ? actBody : (data.storyBlurb ?? data.description)
  const mediaSrc = isActView ? data.image : (data.storyImage ?? data.image)
  const shouldRenderMedia = isActView || Boolean(mediaSrc)

  return (
    <section className="panel stage" data-stage-display={display}>
      {shouldRenderMedia ? (
        <div className="stage__media">
          <Media
            kind="image"
            src={mediaSrc}
            alt={primaryTitle}
            ratio="16:9"
            variant="hero"
            fit="cover"
            priority
            sizes="100vw"
            role="decorative"
            fallback={{
              type: 'gradient',
              label: isActView ? `Act ${data.act}` : undefined,
            }}
          />
        </div>
      ) : null}
      <div className="stage__content">
        <div className="stage__eyebrow" data-testid={isActView ? 'stage-act-eyebrow' : 'stage-eyebrow'}>
          <span>{data.state}</span>
          <span aria-hidden="true"> · </span>
          <span>Act {data.act}</span>
        </div>
        <h1 className="stage__storyTitle">{primaryTitle}</h1>
        {secondaryTitle ? <div className="stage__title">{secondaryTitle}</div> : null}
      </div>
      {showDescription ? (
        <p className={`stage__description${!bodyText.trim() ? ' stage__description--empty' : ''}`}>
          {bodyText}
        </p>
      ) : null}
    </section>
  )
}
