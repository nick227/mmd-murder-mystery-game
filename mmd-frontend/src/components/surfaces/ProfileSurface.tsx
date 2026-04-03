import type { ScreenData } from '../../data/types'
import { PlayerProfileTemplate } from '../templates/player/PlayerProfileTemplate'

interface Props {
  data: ScreenData
}

export function ProfileSurface({ data }: Props) {
  return <PlayerProfileTemplate profile={data.profile} />
}

