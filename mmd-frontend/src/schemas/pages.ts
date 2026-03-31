import type { PageSchema } from '../data/types'

export const launcherPageSchema: PageSchema = {
  id: 'launcher',
  layouts: {
    root: [{ id: 'launcher', type: 'launcher', bind: 'launcher' }],
  },
}

export const joinPageSchema: PageSchema = {
  id: 'player-entry',
  layouts: {
    root: [
      { id: 'stage', type: 'stage', bind: 'game' },
      { id: 'join-card', type: 'join-card', bind: 'join' },
    ],
  },
}

export const playerPageSchema: PageSchema = {
  id: 'player-game',
  tabs: [
    { id: 'lobby', label: 'Lobby' },
    { id: 'game', label: 'Game' },
    { id: 'profile', label: 'Profile' },
  ],
  // Player layouts are owned by first-class surface components (LobbySurface/GameSurface/ProfileSurface).
  // This schema only provides tab labels for BottomNav.
  layouts: {},
}

export const hostPageSchema: PageSchema = {
  id: 'host-game',
  tabs: undefined,
  layouts: {
    root: [
      { id: 'stage', type: 'stage', bind: 'game' },
      { id: 'feed', type: 'feed', bind: 'feed' },
      { id: 'actions', type: 'actions', bind: 'gameActions' },
    ],
  },
}
