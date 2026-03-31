import type { ScreenData } from '../../data/types'
import { Panel } from '../ui/Panel'
import { PanelHeader } from '../ui/PanelHeader'
import { Surface } from '../ui/Surface'

interface Props {
  data: ScreenData
  pinnedIds: string[]
  onOpenSource?: (id: string) => void
}

export function CaseboardSurface({ data, pinnedIds, onOpenSource }: Props) {
  const heat = data.view?.heat ?? []
  const timeline = data.view?.timeline ?? []

  const pinnedFeed = data.feed.filter(item => pinnedIds.includes(item.id))
  const pinnedEvidence = (data.view?.evidence ?? []).filter(item => pinnedIds.includes(item.id))

  return (
    <Surface testId="surface-caseboard">
      <Panel>
        <PanelHeader title="Caseboard" meta="Derived view" />
        <div className="list-block">
          <div className="list-row">
            <div className="list-row__main">
              <div className="list-row__title">Pinned</div>
              <div className="list-row__text">
                <span className="list-row__text-inner">{pinnedIds.length ? `${pinnedIds.length} items` : 'Pin items from the feed or evidence.'}</span>
              </div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Suspects" meta={heat.length ? 'Advisory heat' : 'No heat yet'} />
        <div className="list-block">
          {!heat.length ? (
            <div className="list-row">
              <div className="list-row__main">
                <div className="list-row__title">No suspects yet</div>
                <div className="list-row__text">
                  <span className="list-row__text-inner">When players Suspect/Accuse, heat appears here.</span>
                </div>
              </div>
            </div>
          ) : (
            heat.map(item => (
              <div key={item.characterId} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title">{item.name}</div>
                  <div className="list-row__text">
                    <span className="list-row__text-inner">{`Heat: ${item.heat}`}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Timeline" meta={timeline.length ? `${timeline.length} pins` : 'No pins yet'} />
        <div className="list-block">
          {!timeline.length ? (
            <div className="list-row">
              <div className="list-row__main">
                <div className="list-row__title">No timeline pins yet</div>
                <div className="list-row__text">
                  <span className="list-row__text-inner">“Searched” and “Solved” moves add pins automatically.</span>
                </div>
              </div>
            </div>
          ) : (
            timeline.map(pin => (
              <div key={pin.id} className="list-row">
                <div className="list-row__main">
                  <div className="list-row__title">{pin.label}</div>
                  <div className="list-row__text">
                    <span className="list-row__text-inner">{pin.act ? `Act ${pin.act}` : ''}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Pinned evidence" meta={String(pinnedEvidence.length)} />
        <div className="list-block">
          {!pinnedEvidence.length ? (
            <div className="list-row">
              <div className="list-row__main">
                <div className="list-row__title">Nothing pinned</div>
              </div>
            </div>
          ) : (
            pinnedEvidence.map(item => (
              <div key={item.id} className={onOpenSource ? 'list-row is-clickable' : 'list-row'} role={onOpenSource ? 'button' : undefined} tabIndex={onOpenSource ? 0 : undefined} onClick={onOpenSource ? () => onOpenSource(item.id) : undefined}>
                <div className="list-row__main">
                  <div className="list-row__title">{item.title}</div>
                  <div className="list-row__text">
                    <span className="list-row__text-inner">{item.text}</span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>

      <Panel>
        <PanelHeader title="Pinned feed" meta={String(pinnedFeed.length)} />
        <div className="list-block">
          {!pinnedFeed.length ? (
            <div className="list-row">
              <div className="list-row__main">
                <div className="list-row__title">Nothing pinned</div>
              </div>
            </div>
          ) : (
            pinnedFeed.map(item => (
              <div key={item.id} className={onOpenSource ? 'list-row is-clickable' : 'list-row'} role={onOpenSource ? 'button' : undefined} tabIndex={onOpenSource ? 0 : undefined} onClick={onOpenSource ? () => onOpenSource(item.id) : undefined}>
                <div className="list-row__main">
                  <div className="list-row__title">{item.text}</div>
                </div>
              </div>
            ))
          )}
        </div>
      </Panel>
    </Surface>
  )
}

