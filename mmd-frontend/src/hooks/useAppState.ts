import { useEffect, useMemo, useState } from 'react'
import {
  createGame,
  fetchHostGame,
  fetchPlayerViewByCharacter,
  fetchStories,
  joinPlayerByCharacter,
  postEndNight,
  postHostAction,
} from '../data/api'
import { playerViewToScreenData } from '../data/adapters'
import { defaultLauncherData, emptyScreenData } from '../data/mock'
import type {
  FeedItem,
  HostApiGame,
  RendererHandlers,
  ScreenData,
  TabId,
} from '../data/types'

function readQuery(name: string) {
  return new URLSearchParams(window.location.search).get(name)
}

function writeQuery(params: Record<string, string | undefined>) {
  const query = new URLSearchParams(window.location.search)
  Object.entries(params).forEach(([key, value]) => {
    if (!value) query.delete(key)
    else query.set(key, value)
  })
  const suffix = query.toString()
  window.history.replaceState({}, '', `${window.location.pathname}${suffix ? `?${suffix}` : ''}`)
}

function routeParts() {
  return window.location.pathname.split('/').filter(Boolean)
}

function buildPlayerPath(gameId: string, characterId: string, apiBase: string) {
  const query = new URLSearchParams()
  if (apiBase) query.set('api', apiBase)
  const suffix = query.toString()
  return `${window.location.origin}/play/${gameId}/${characterId}${suffix ? `?${suffix}` : ''}`
}

function buildHostPath(gameId: string, hostKey: string, apiBase: string) {
  const query = new URLSearchParams()
  query.set('hostKey', hostKey)
  if (apiBase) query.set('api', apiBase)
  return `${window.location.origin}/host/${gameId}?${query.toString()}`
}

function countdownParts(scheduledTime?: string) {
  if (!scheduledTime) return { label: undefined, percent: undefined }
  const target = new Date(scheduledTime).getTime()
  const diff = target - Date.now()
  if (diff <= 0) return { label: 'Start anytime', percent: 100 }
  const total = 2 * 60 * 60 * 1000
  const pct = ((total - Math.min(diff, total)) / total) * 100
  const minutes = Math.ceil(diff / (60 * 1000))
  return { label: `${minutes}m until start`, percent: Math.max(5, Math.min(100, pct)) }
}

function storyHeroImage(title: string): string {
  const key = title.toLowerCase()
  if (key.includes('diamond') || key.includes('hollywood')) {
    return 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80'
  }
  return 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80'
}

function buildHostScreen(game: HostApiGame, apiBase: string): ScreenData {
  const countdown = countdownParts(game.scheduledTime)
  const playerLinks = game.players.map(player => ({
    characterId: player.characterId,
    label: player.characterName ?? player.playerName ?? `Character ${player.characterId}`,
    url: buildPlayerPath(game.id, player.characterId, apiBase),
    joined: Boolean(player.joinedAt),
  }))

  const feed: FeedItem[] = [
    {
      id: 'host-system',
      type: 'system',
      text: game.state === 'SCHEDULED'
        ? 'Lobby is open. The host can start early at any time.'
        : game.state === 'REVEAL'
        ? 'Reveal is in progress.'
        : `Act ${game.currentAct} is active.`,
    },
  ]

  return {
    ...emptyScreenData,
    game: {
      state: game.state,
      act: game.currentAct,
      title: game.state === 'SCHEDULED' ? 'Host lobby' : game.state === 'REVEAL' ? 'Reveal in progress' : `Act ${game.currentAct}`,
      subtitle: `${game.storyTitle ?? game.name} · Host control room`,
      description: game.state === 'SCHEDULED'
        ? 'Share character links, watch who joins, and start whenever the room is ready.'
        : game.state === 'REVEAL'
        ? 'Answers are live. Finish the game when you are ready.'
        : 'Everyone is in the game. Advance acts only when the room is ready.',
      image: storyHeroImage(game.storyTitle ?? game.name),
      countdownLabel: game.state === 'SCHEDULED' ? countdown.label : undefined,
      countdownPercent: game.state === 'SCHEDULED' ? countdown.percent : undefined,
      banner: game.state === 'SCHEDULED'
        ? 'You are in the host control room.'
        : 'Host controls are live.',
    },
    players: game.players.map(player => ({
      id: player.id,
      name: player.characterName ?? player.playerName ?? `Character ${player.characterId}`,
      characterId: player.characterId,
      online: Boolean(player.joinedAt),
    })),
    feed,
    objectives: {
      personal: [],
      group: [],
      host: [
        { id: 'host-1', text: 'Watch joined status and wait until the room is ready.', completed: false },
        { id: 'host-2', text: 'Advance acts only when conversation energy drops.', completed: false },
        { id: 'host-3', text: 'Use End Night only after final discussion.', completed: false },
      ],
    },
    profile: {
      characterName: 'Host',
      archetype: 'Game master',
      biography: 'You control pacing, stage transitions, and the reveal.',
      secrets: [],
      items: [],
      cards: [],
    },
    composer: {
      mode: 'public',
      draft: '',
      placeholder: 'Host messaging is still frontend-only in this patch.',
      recipients: [],
      canSend: false,
    },
    gameActions:
      game.state === 'SCHEDULED'
        ? [{ id: 'start', label: 'Start Game', kind: 'primary' }]
        : game.state === 'PLAYING'
        ? [
            { id: 'next', label: game.currentAct >= 5 ? 'At Final Act' : `Next Act (${game.currentAct + 1})`, kind: 'primary', disabled: game.currentAct >= 5 },
            { id: 'end', label: 'End Night', kind: 'danger' },
          ]
        : game.state === 'REVEAL'
        ? [{ id: 'finish', label: 'Finish Game', kind: 'primary' }]
        : [],
    hostInfo: {
      gameId: game.id,
      storyTitle: game.storyTitle ?? game.name,
      scheduledTime: game.scheduledTime,
      locationText: game.locationText,
      hostKey: game.hostKey,
      playerLinks,
    },
  }
}

export function useTabState(defaultTab: TabId) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)
  return [activeTab, setActiveTab] as const
}

export function useViewMode() {
  const parts = routeParts()
  const apiBase = readQuery('api') ?? ''
  if (parts[0] === 'host' && parts[1]) {
    return { mode: 'host' as const, apiBase, gameId: parts[1], characterId: null, hostKey: readQuery('hostKey') }
  }
  if (parts[0] === 'play' && parts[1] && parts[2]) {
    return { mode: 'player' as const, apiBase, gameId: parts[1], characterId: parts[2], hostKey: null }
  }
  return { mode: 'launcher' as const, apiBase, gameId: null, characterId: null, hostKey: null }
}

export function useLauncherState() {
  const [screenData, setScreenData] = useState<ScreenData>({
    ...emptyScreenData,
    launcher: {
      ...defaultLauncherData,
      apiBase: readQuery('api') ?? defaultLauncherData.apiBase,
      form: {
        ...defaultLauncherData.form,
        apiBase: readQuery('api') ?? defaultLauncherData.apiBase,
      },
    },
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    const apiBase = screenData.launcher?.apiBase ?? ''
    setLoading(true)
    setError('')
    fetchStories(apiBase)
      .then(stories => {
        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? {
                ...current.launcher,
                stories,
                form: {
                  ...current.launcher.form,
                  storyId: current.launcher.form.storyId || stories[0]?.id || '',
                },
              }
            : current.launcher,
        }))
      })
      .catch(err => setError((err as Error).message))
      .finally(() => setLoading(false))
  }, [screenData.launcher?.apiBase])

  const handlers: RendererHandlers = useMemo(() => ({
    onLauncherFieldChange: (field, value) => {
      setScreenData(current => {
        const launcher = current.launcher
        if (!launcher) return current
        if (field === 'apiBase') {
          writeQuery({ api: value || undefined })
          return {
            ...current,
            launcher: {
              ...launcher,
              apiBase: value,
              form: { ...launcher.form, apiBase: value },
              createdGame: undefined,
            },
          }
        }
        return {
          ...current,
          launcher: { ...launcher, form: { ...launcher.form, [field]: value } },
        }
      })
    },
    onCreateGame: async () => {
      const launcher = screenData.launcher
      if (!launcher?.form.storyId) {
        setError('Select a story first.')
        return
      }
      setLoading(true)
      setError('')
      try {
        const game = await createGame(launcher.apiBase, {
          storyId: launcher.form.storyId,
          name: launcher.form.name,
          scheduledTime: new Date(launcher.form.scheduledTime).toISOString(),
          locationText: launcher.form.locationText,
        })
        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? {
                ...current.launcher,
                createdGame: {
                  id: game.id,
                  name: game.name,
                  hostKey: game.hostKey,
                  hostUrl: buildHostPath(game.id, game.hostKey, launcher.apiBase),
                  playerLinks: game.players.map(player => ({
                    label: player.characterName ?? `Character ${player.characterId}`,
                    url: buildPlayerPath(game.id, player.characterId, launcher.apiBase),
                  })),
                },
              }
            : current.launcher,
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to create game')
      } finally {
        setLoading(false)
      }
    },
    onCopyText: async value => {
      try {
        await navigator.clipboard.writeText(value)
      } catch {
        window.prompt('Copy this value:', value)
      }
    },
  }), [screenData.launcher])

  return { screenData, handlers, loading, error }
}

export function usePlayerScreenData(
  apiBase: string,
  gameId: string | null,
  characterId: string | null,
) {
  const joinStorageKey = gameId && characterId ? `mmd-player-name:${gameId}:${characterId}` : ''
  const [screenData, setScreenData] = useState<ScreenData>(emptyScreenData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(Boolean(joinStorageKey && localStorage.getItem(joinStorageKey)))
  const [joinDraft, setJoinDraft] = useState(joinStorageKey ? (localStorage.getItem(joinStorageKey) ?? '') : '')

  const reload = async () => {
    if (!gameId || !characterId) return
    setLoading(true)
    setError('')
    try {
      const view = await fetchPlayerViewByCharacter(apiBase, gameId, characterId)
      setScreenData(playerViewToScreenData(view, joinDraft))
      if (view.playerName) {
        setJoined(true)
        if (joinStorageKey) localStorage.setItem(joinStorageKey, view.playerName)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!gameId || !characterId) return
    void reload()
    const interval = window.setInterval(() => void reload(), 8000)
    return () => window.clearInterval(interval)
  }, [apiBase, gameId, characterId])

  const handlers: RendererHandlers = useMemo(() => ({
    onObjectiveToggle: objectiveId => {
      setScreenData(current => ({
        ...current,
        objectives: {
          ...current.objectives,
          personal: current.objectives.personal.map(item => item.id === objectiveId ? { ...item, completed: !item.completed } : item),
          group: current.objectives.group.map(item => item.id === objectiveId ? { ...item, completed: !item.completed } : item),
        },
      }))
    },
    onJoinNameChange: value => {
      setJoinDraft(value)
      setScreenData(current => ({
        ...current,
        join: current.join ? { ...current.join, playerName: value } : current.join,
      }))
    },
    onJoinSubmit: async () => {
      if (!gameId || !characterId || !joinDraft.trim()) return
      setLoading(true)
      setError('')
      try {
        await joinPlayerByCharacter(apiBase, gameId, characterId, joinDraft.trim())
        if (joinStorageKey) localStorage.setItem(joinStorageKey, joinDraft.trim())
        setJoined(true)
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to join game')
      } finally {
        setLoading(false)
      }
    },
    onComposerModeChange: mode => {
      setScreenData(current => ({ ...current, composer: { ...current.composer, mode } }))
    },
    onComposerDraftChange: value => {
      setScreenData(current => ({ ...current, composer: { ...current.composer, draft: value, canSend: value.trim().length > 0 } }))
    },
  }), [apiBase, gameId, characterId, joinDraft])

  return { screenData, handlers, loading, error, reload, joined }
}

export function useHostScreenData(
  apiBase: string,
  gameId: string | null,
  hostKey: string | null,
) {
  const [screenData, setScreenData] = useState<ScreenData>(emptyScreenData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const reload = async () => {
    if (!gameId || !hostKey) return
    setLoading(true)
    setError('')
    try {
      const game = await fetchHostGame(apiBase, gameId, hostKey)
      setScreenData(buildHostScreen(game, apiBase))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load host view')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!gameId || !hostKey) return
    void reload()
    const interval = window.setInterval(() => void reload(), 5000)
    return () => window.clearInterval(interval)
  }, [apiBase, gameId, hostKey])

  const handlers: RendererHandlers = useMemo(() => ({
    onObjectiveToggle: objectiveId => {
      setScreenData(current => ({
        ...current,
        objectives: {
          ...current.objectives,
          host: (current.objectives.host ?? []).map(item => item.id === objectiveId ? { ...item, completed: !item.completed } : item),
        },
      }))
    },
    onAction: async actionId => {
      if (!gameId || !hostKey) return
      setLoading(true)
      setError('')
      try {
        if (actionId === 'start') {
          await postHostAction(apiBase, gameId, hostKey, 'start')
        } else if (actionId === 'next') {
          await postHostAction(apiBase, gameId, hostKey, 'next-act')
        } else if (actionId === 'end') {
          const who = window.prompt('Who did it?')?.trim()
          const how = window.prompt('How was it done?')?.trim()
          const why = window.prompt('Why did it happen?')?.trim()
          if (!who || !how || !why) {
            setLoading(false)
            return
          }
          await postEndNight(apiBase, gameId, hostKey, { who, how, why })
        } else if (actionId === 'finish') {
          await postHostAction(apiBase, gameId, hostKey, 'done')
        }
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Host action failed')
      } finally {
        setLoading(false)
      }
    },
    onCopyText: async value => {
      try {
        await navigator.clipboard.writeText(value)
      } catch {
        window.prompt('Copy this value:', value)
      }
    },
  }), [apiBase, gameId, hostKey])

  return { screenData, handlers, loading, error, reload }
}
