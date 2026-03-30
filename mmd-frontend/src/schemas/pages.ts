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
    { id: 'profile', label: 'Profile' },
  ],
  layouts: {
    game: [
      { id: 'stage', type: 'stage', bind: 'game' },
      { id: 'feed', type: 'feed', bind: 'feed' },
      { id: 'composer', type: 'composer', bind: 'composer' },
    ],
    objectives: [
      {
        id: 'personal-section',
        type: 'section',
        title: 'Personal objectives',
        children: [{ id: 'personal-list', type: 'list', bind: 'objectives.personal', emptyText: 'No personal objectives yet.' }],
      },
      {
        id: 'group-section',
        type: 'section',
        title: 'Group objectives',
        children: [{ id: 'group-list', type: 'list', bind: 'objectives.group', emptyText: 'No group objectives yet.' }],
      },
    ],
    profile: [
      { id: 'character-profile', type: 'profile-card', bind: 'profile' },
      {
        id: 'secrets-section',
        type: 'section',
        title: 'Secrets',
        children: [{ id: 'secrets-list', type: 'list', bind: 'profile.secrets', emptyText: 'No secrets loaded.' }],
      },
      {
        id: 'items-section',
        type: 'section',
        title: 'Items',
        children: [{ id: 'items-list', type: 'list', bind: 'profile.items', emptyText: 'No items loaded.' }],
      },
      {
        id: 'cards-section',
        type: 'section',
        title: 'Instruction cards',
        children: [{ id: 'cards-list', type: 'list', bind: 'profile.cards', emptyText: 'No instruction cards yet.' }],
      },
    ],
  },
}

export const hostPageSchema: PageSchema = {
  ...playerPageSchema,
  id: 'host-game',
  layouts: {
    game: [
      { id: 'host-info', type: 'host-info', bind: 'hostInfo' },
      { id: 'stage', type: 'stage', bind: 'game' },
      { id: 'feed', type: 'feed', bind: 'feed' },
      { id: 'actions', type: 'actions', bind: 'gameActions' },
    ],
    objectives: [
      ...playerPageSchema.layouts.objectives,
      {
        id: 'host-section',
        type: 'section',
        title: 'Host responsibilities',
        children: [{ id: 'host-list', type: 'list', bind: 'objectives.host', emptyText: 'No host objectives yet.' }],
      },
    ],
    profile: playerPageSchema.layouts.profile,
  },
}
