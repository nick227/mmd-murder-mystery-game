import { Panel } from '../../ui/Panel'
import { PanelHeader } from '../../ui/PanelHeader'
import { Surface } from '../../ui/Surface'

/** Act objectives and evidence live on Lobby under your character; this tab is optional. */
export function PlayerGameTemplate() {
  return (
    <Surface testId="surface-game" surface="game" dataUi="GameSurface">
      <Panel>
        <PanelHeader title="Game" meta="At a glance" />
        <p style={{ color: 'var(--text)', lineHeight: 1.45, margin: 0 }}>
          Current act, objectives, and evidence are on the Lobby tab — scroll to the section below your character.
        </p>
      </Panel>
    </Surface>
  )
}
