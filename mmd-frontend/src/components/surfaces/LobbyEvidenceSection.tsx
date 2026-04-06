import { useState } from 'react'
import type { EvidenceItem } from '../../data/types'
import { EvidenceSection } from './EvidenceSection'
import { FocusPanel } from './FocusPanel'
import { ui } from '../../utils/uiMarkers'

type Props = {
  evidence: EvidenceItem[]
  currentAct: number
}

export function LobbyEvidenceSection({ evidence, currentAct }: Props) {
  const [focus, setFocus] = useState<EvidenceItem | null>(null)

  return (
    <section className="lobby-stack surface surface--game" data-testid="lobby-evidence" {...ui('LobbyEvidenceSection')}>
      <FocusPanel item={focus} onClose={() => setFocus(null)} />
      <EvidenceSection items={evidence} currentAct={currentAct} onItemClick={setFocus} />
    </section>
  )
}
