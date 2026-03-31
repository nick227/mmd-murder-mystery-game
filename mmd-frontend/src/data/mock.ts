import type { LauncherData, ScreenData } from './types'

const DEFAULT_API_BASE = ''

export const defaultLauncherData: LauncherData = {
  apiBase: DEFAULT_API_BASE,
  stories: [],
  form: {
    apiBase: DEFAULT_API_BASE,
    storyId: '',
    name: 'Saturday Night Mystery',
    scheduledTime: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().slice(0, 16),
    locationText: "Nick's house",
  },
}

export const emptyScreenData: ScreenData = {
  game: {
    state: 'SCHEDULED',
    act: 0,
    title: 'Waiting for game',
    subtitle: 'Murder Mystery Dinner',
    description: 'Pick a story, create a game, or open a host/player link.',
  },
  players: [],
  feed: [],
  view: {
    doNow: [],
    evidence: [],
  },
  objectives: {
    personal: [],
    group: [],
    reveals: [],
    host: [],
  },
  profile: {
    characterName: 'Player',
    archetype: 'Guest',
    biography: 'Character details will appear here after the game begins.',
    secrets: [],
    items: [],
    cards: [],
  },
  composer: {
    mode: 'public',
    draft: '',
    placeholder: 'Messaging is not wired to the backend yet.',
    recipients: [],
    canSend: false,
  },
  gameActions: [],
  launcher: defaultLauncherData,
  join: {
    title: 'Join game',
    subtitle: 'Enter your name to join the room.',
    playerName: '',
    submitLabel: 'Join game',
  },
}
