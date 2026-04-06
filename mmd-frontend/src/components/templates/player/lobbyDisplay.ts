import type { StageData } from '../../../data/types'

export function lobbyHostLabel(stage: StageData): string {
  const t = stage.hostName?.trim()
  return t && t.length > 0 ? t : 'Host'
}

export function lobbyLocationLabel(stage: StageData): string {
  const t = stage.locationText?.trim()
  return t && t.length > 0 ? t : 'Location TBD'
}

export function lobbyStoryDescriptionVisible(stage: StageData): boolean {
  return Boolean((stage.storyBlurb ?? stage.description).trim())
}
