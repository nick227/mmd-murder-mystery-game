import type { RendererHandlers, ScreenData } from '../../data/types'
import { RenderNode } from '../primitives'
import { BottomSheet } from '../ui/BottomSheet'

export type InviteLinksSheetModel = null | {
  gameId: string
  screenData: ScreenData
  handlers: RendererHandlers
  onClose: () => void
}

export interface InviteLinksSheetProps {
  inviteSheet: InviteLinksSheetModel
}

export function InviteLinksSheet(props: InviteLinksSheetProps) {
  const { inviteSheet } = props

  return inviteSheet ? (
    <BottomSheet
      open={true}
      onClose={inviteSheet.onClose}
      eyebrow="Host only"
      title="Invite links"
      meta={`Game ${inviteSheet.gameId}`}
    >
      <RenderNode
        node={{ id: 'invite-links', type: 'host-info', bind: 'hostInfo' }}
        data={inviteSheet.screenData}
        handlers={inviteSheet.handlers}
      />
    </BottomSheet>
  ) : null
}
