import type { RoomPlayer, StageData } from '../../data/types'
import { ui } from '../../utils/uiMarkers'
import { Pills } from './Pills'

export function Stage({ data, players, showPlayers = true }: { data: StageData; players: RoomPlayer[]; showPlayers?: boolean }) {
  const safePercent = typeof data.countdownPercent === 'number'
    ? Math.max(0, Math.min(100, data.countdownPercent))
    : null

  return (
    <section className="panel stage" {...ui('Stage')}>
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
      {showPlayers && players.length ? (
        <div className="player-pills" aria-label="Players in room">
          <Pills players={players} />
        </div>
      ) : null}
    </section>
  )
}
