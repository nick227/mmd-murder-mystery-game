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
    { id: 'game', label: 'Game' },
    { id: 'objectives', label: 'Objectives' },
    { id: 'profile', label: 'Character' },
  ],
  layouts: {
    game: [
      { id: 'stage', type: 'stage', bind: 'game' },
      {
        id: 'new-this-act-section',
        type: 'section',
        title: 'New this act',
        children: [{ id: 'new-this-act-list', type: 'list', bind: 'objectives.group', emptyText: 'No new items this act.' }],
      },
      {
        id: 'clues-section',
        type: 'section',
        title: 'Clues',
        children: [{ id: 'clues-list', type: 'list', bind: 'profile.cards', emptyText: 'No clues yet.' }],
      },
      { id: 'composer', type: 'composer', bind: 'composer' },
    ],
    objectives: [
      {
        id: 'personal-section',
        type: 'section',
        title: 'Your objectives',
        children: [{ id: 'personal-list', type: 'list', bind: 'objectives.personal', emptyText: 'No personal objectives yet.' }],
      },
    ],
    profile: [
      { id: 'character-profile', type: 'profile-card', bind: 'profile' },
    ],
  },
}

export const hostPageSchema: PageSchema = {
  ...playerPageSchema,
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
