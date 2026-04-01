import { useEffect, useMemo, useRef, useState } from 'react'
import { normaliseFeedEvent, playerViewToScreenData } from '../data/adapters'
import { defaultLauncherData, emptyScreenData } from '../data/mock'
import { getGameSource, readGameSourceModeFromLocation } from '../data/sources/getGameSource'
import { storyHeroImage } from '../utils/storyHeroImage'
import { readStoredGames } from '../data/runningGamesRegistry'
import type {
  FeedItem,
  HostApiGame,
  PostKind,
  RendererHandlers,
  ScreenData,
  TabId,
} from '../data/types'
import { encodeClueToken, encodeLocationToken } from '../utils/feedRichText'
import { upsertCreatedGame, upsertHostLink, upsertPlayerLink } from '../data/runningGamesRegistry'

function composerCanSend(input: { postKind?: PostKind; draft: string; recipientId?: string; evidenceId?: string; location?: string }): boolean {
  const postKind = input.postKind ?? 'suspect'
  const needsTarget = postKind === 'suspect' || postKind === 'accuse'
  const needsText = postKind === 'alibi' || postKind === 'solved'
  if (needsTarget && !input.recipientId) return false
  if (needsText && input.draft.trim().length === 0) return false
  if (postKind === 'share_clue' && input.draft.trim().length === 0 && !input.evidenceId) return false
  if (postKind === 'searched' && input.draft.trim().length === 0 && !input.location) return false
  return true
}

// Phase 1: localStorage state is no longer used by the frontend.

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

function buildPlayerPath(gameId: string, characterId: string, query: URLSearchParams) {
  const suffix = query.toString()
  return `${window.location.origin}/room/${gameId}/${characterId}${suffix ? `?${suffix}` : ''}`
}

function buildHostPath(gameId: string, hostKey: string, query: URLSearchParams) {
  query.set('hostKey', hostKey)
  return `${window.location.origin}/host/${gameId}?${query.toString()}`
}

function buildShareQuery(params: { apiBase: string }) {
  const query = new URLSearchParams()
  if (params.apiBase) query.set('api', params.apiBase)
  return query
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

// (moved) storyHeroImage -> src/utils/storyHeroImage.ts

function buildHostScreen(game: HostApiGame, apiBase: string): ScreenData {
  const countdown = countdownParts(game.scheduledTime)
  const shareQuery = buildShareQuery({ apiBase })
  const playerLinks = game.players.map(player => ({
    characterId: player.characterId,
    label: player.characterName ?? player.playerName ?? `Character ${player.characterId}`,
    url: buildPlayerPath(game.id, player.characterId, shareQuery),
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

  if (Array.isArray(game.feed) && game.feed.length) {
    feed.push(...game.feed.slice(-20).map(normaliseFeedEvent))
  }

  return {
    ...emptyScreenData,
    game: {
      state: game.state,
      act: game.currentAct,
      title: game.state === 'SCHEDULED' ? 'Host lobby' : game.state === 'REVEAL' ? 'Reveal in progress' : `Act ${game.currentAct}`,
      subtitle: `${game.storyTitle ?? game.name} · Host control room`,
      description: game.stageText
        ? String(game.stageText)
        : game.state === 'SCHEDULED'
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
      reveals: [],
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
        ? [{ id: 'next', label: `Next Act (${game.currentAct + 1})`, kind: 'primary' }]
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

function readPinnedIds(key: string): string[] {
  try {
    const raw = window.localStorage.getItem(key)
    const parsed = raw ? JSON.parse(raw) : []
    return Array.isArray(parsed) ? parsed.map(String) : []
  } catch {
    return []
  }
}

function writePinnedIds(key: string, ids: string[]) {
  try {
    window.localStorage.setItem(key, JSON.stringify(ids))
  } catch {
    // ignore
  }
}

export function usePinnedIds(input: { gameId?: string | null; characterId?: string | null }) {
  // User-local UI memory only (view preference). Not authoritative game state.
  // Intentionally stored per-device to avoid merging semantics until/unless we opt into server sync later.
  const key = `mmd:view:pins:${String(input.gameId ?? '')}:${String(input.characterId ?? '')}`
  const [pinnedIds, setPinnedIds] = useState<string[]>(() => readPinnedIds(key))

  useEffect(() => {
    setPinnedIds(readPinnedIds(key))
  }, [key])

  const togglePinned = (id: string) => {
    setPinnedIds(current => {
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
      writePinnedIds(key, next)
      return next
    })
  }

  const isPinned = (id: string) => pinnedIds.includes(id)

  return { pinnedIds, togglePinned, isPinned }
}

export function useViewMode() {
  const parts = routeParts()
  const apiBase = readQuery('api') ?? ''
  const hostKey = readQuery('hostKey')

  if (parts[0] === 'room' && parts[1] && parts[2]) {
    return { mode: 'room' as const, apiBase, gameId: parts[1], characterId: parts[2], hostKey }
  }

  if (parts[0] === 'host' && parts[1]) {
    // Back-compat: try to redirect host link into /room using locally-saved characterIds.
    if (hostKey) {
      const saved = readStoredGames().find(g => g.gameId === parts[1] && g.apiBase === apiBase)
      const characterId = saved?.characterIds?.[0]
      if (characterId) {
        const query = new URLSearchParams(window.location.search)
        window.history.replaceState({}, '', `/room/${parts[1]}/${characterId}?${query.toString()}`)
        return { mode: 'room' as const, apiBase, gameId: parts[1], characterId, hostKey }
      }
    }
    return { mode: 'host' as const, apiBase, gameId: parts[1], characterId: null, hostKey: readQuery('hostKey') }
  }
  if (parts[0] === 'play' && parts[1] && parts[2]) {
    // Back-compat: redirect /play to /room preserving query.
    const query = window.location.search
    window.history.replaceState({}, '', `/room/${parts[1]}/${parts[2]}${query}`)
    return { mode: 'room' as const, apiBase, gameId: parts[1], characterId: parts[2], hostKey }
  }
  return { mode: 'launcher' as const, apiBase, gameId: null, characterId: null, hostKey: null }
}

export function useLauncherState() {
  const source = readGameSourceModeFromLocation()
  const gameSource = getGameSource(source)
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
    Promise.all([gameSource.fetchStories(apiBase), gameSource.fetchGames(apiBase)])
      .then(([stories, games]) => {
        const savedGames = readStoredGames()
        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? {
                ...current.launcher,
                stories,
                allGames: games,
                savedGames,
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
  }, [screenData.launcher?.apiBase, source])

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
        const game = await gameSource.createGame(launcher.apiBase, {
          storyId: launcher.form.storyId,
          name: launcher.form.name,
          scheduledTime: new Date(launcher.form.scheduledTime).toISOString(),
          locationText: launcher.form.locationText,
        })
        upsertCreatedGame({
          gameId: game.id,
          apiBase: launcher.apiBase,
          hostKey: game.hostKey,
          characterIds: game.players.map(p => p.characterId),
        })
        const savedGames = readStoredGames()
        const shareQuery = buildShareQuery({ apiBase: launcher.apiBase })
        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? {
                ...current.launcher,
                savedGames,
                createdGame: {
                  id: game.id,
                  name: game.name,
                  hostKey: game.hostKey,
                  scheduledTime: game.scheduledTime,
                  hostUrl: buildHostPath(game.id, game.hostKey, shareQuery),
                  playerLinks: game.players.map(player => ({
                    characterId: player.characterId,
                    label: player.characterName ?? `Character ${player.characterId}`,
                    url: buildPlayerPath(game.id, player.characterId, shareQuery),
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
    onRescheduleGame: async (rescheduleGameId, rescheduleHostKey, scheduledTime) => {
      const launcher = screenData.launcher
      if (!launcher) return
      setLoading(true)
      setError('')
      try {
        await gameSource.rescheduleGame(launcher.apiBase, rescheduleGameId, rescheduleHostKey, scheduledTime)
        const games = await gameSource.fetchGames(launcher.apiBase)
        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? { ...current.launcher, allGames: games }
            : current.launcher,
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reschedule game')
      } finally {
        setLoading(false)
      }
    },
    onCancelGame: async (cancelGameId, cancelHostKey) => {
      const launcher = screenData.launcher
      if (!launcher) return
      setLoading(true)
      setError('')
      try {
        await gameSource.cancelGame(launcher.apiBase, cancelGameId, cancelHostKey)
        const [stories, games] = await Promise.all([
          gameSource.fetchStories(launcher.apiBase),
          gameSource.fetchGames(launcher.apiBase),
        ])
        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? {
                ...current.launcher,
                stories,
                allGames: games,
                savedGames: readStoredGames(),
              }
            : current.launcher,
        }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to cancel game')
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
  const source = readGameSourceModeFromLocation()
  const gameSource = getGameSource(source)
  const [screenData, setScreenData] = useState<ScreenData>(emptyScreenData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [joined, setJoined] = useState(false)
  const [joinDraft, setJoinDraft] = useState('')
  const joinDraftRef = useRef('')
  const [composerState, setComposerState] = useState<{ postKind: PostKind; draft: string; recipientId?: string; evidenceId?: string; location?: string }>({
    postKind: 'suspect',
    draft: '',
  })
  const composerStateRef = useRef(composerState)

  useEffect(() => {
    joinDraftRef.current = joinDraft
  }, [joinDraft])

  useEffect(() => {
    composerStateRef.current = composerState
  }, [composerState])

  useEffect(() => {
    if (!gameId || !characterId) return
    upsertPlayerLink({ gameId, apiBase, characterId })
  }, [apiBase, gameId, characterId])

  const reload = async () => {
    if (!gameId || !characterId) return
    setLoading(true)
    setError('')
    try {
      const view = await gameSource.fetchPlayerViewByCharacter(apiBase, gameId, characterId)
      const base = playerViewToScreenData(view, joinDraftRef.current)
      const latestComposer = composerStateRef.current
      const nextComposer = {
        ...base.composer,
        mode: 'public' as const,
        postKind: latestComposer.postKind,
        draft: latestComposer.draft,
        recipientId: latestComposer.recipientId,
        evidenceId: latestComposer.evidenceId,
        location: latestComposer.location,
      }
      setScreenData({ ...base, composer: { ...nextComposer, canSend: composerCanSend(nextComposer) } })
      if (view.playerName) {
        setJoined(true)
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
    onObjectiveSubmit: async objectiveId => {
      setScreenData(current => ({
        ...current,
        objectives: {
          ...current.objectives,
          personal: current.objectives.personal.map(item => item.id === objectiveId ? { ...item, completed: !item.completed } : item),
          group: current.objectives.group.map(item => item.id === objectiveId ? { ...item, completed: !item.completed } : item),
          reveals: current.objectives.reveals,
        },
      }))

      if (source === 'api' && gameId && characterId) {
        try {
          // Act is server-owned; pass client act only as informational.
          await gameSource.submitObjective(apiBase, gameId, characterId, objectiveId)
          await reload()
        } catch (err) {
          setError(err instanceof Error ? err.message : 'Failed to submit objective')
        }
      }
    },
    onJoinNameChange: value => {
      joinDraftRef.current = value
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
        await gameSource.joinPlayerByCharacter(apiBase, gameId, characterId, joinDraft.trim())
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
    onComposerPostKindChange: postKind => {
      setComposerState(current => {
        const next = { ...current, postKind }
        composerStateRef.current = next
        return next
      })
      setScreenData(current => {
        const next = { ...current.composer, postKind }
        return { ...current, composer: { ...next, canSend: composerCanSend(next) } }
      })
    },
    onComposerRecipientChange: recipientId => {
      setComposerState(current => {
        const next = { ...current, recipientId }
        composerStateRef.current = next
        return next
      })
      setScreenData(current => {
        const next = { ...current.composer, recipientId }
        return { ...current, composer: { ...next, canSend: composerCanSend(next) } }
      })
    },
    onComposerEvidenceChange: evidenceId => {
      setComposerState(current => {
        const next = { ...current, evidenceId }
        composerStateRef.current = next
        return next
      })
      setScreenData(current => {
        const next = { ...current.composer, evidenceId }
        return { ...current, composer: { ...next, canSend: composerCanSend(next) } }
      })
    },
    onComposerLocationChange: location => {
      setComposerState(current => {
        const next = { ...current, location }
        composerStateRef.current = next
        return next
      })
      setScreenData(current => {
        const next = { ...current.composer, location }
        return { ...current, composer: { ...next, canSend: composerCanSend(next) } }
      })
    },
    onComposerDraftChange: value => {
      setComposerState(current => {
        const next = { ...current, draft: value }
        composerStateRef.current = next
        return next
      })
      setScreenData(current => {
        const next = { ...current.composer, draft: value }
        return { ...current, composer: { ...next, canSend: composerCanSend(next) } }
      })
    },
    onComposerSend: async () => {
      if (!gameId || !characterId) return
      const postKind = screenData.composer.postKind ?? 'suspect'
      const recipientId = screenData.composer.recipientId
      const draft = screenData.composer.draft.trim()
      const evidenceId = screenData.composer.evidenceId
      const location = screenData.composer.location?.trim()

      const evidence =
        evidenceId && Array.isArray(screenData.composer.evidenceOptions)
          ? screenData.composer.evidenceOptions.find(o => o.id === evidenceId) ?? null
          : null

      const clueToken = evidence ? ` ${encodeClueToken(evidence)}` : ''
      const locationToken = location ? ` ${encodeLocationToken({ id: location, label: location })}` : ''

      const text =
        postKind === 'share_clue'
          ? `${draft}${clueToken}`.trim()
          : postKind === 'searched'
          ? `${draft}${locationToken}`.trim()
          : draft
      try {
        await gameSource.postToFeed(apiBase, gameId, {
          characterId,
          postKind,
          text: text.length ? text : undefined,
          targetCharacterId: recipientId,
        })
        setComposerState(current => ({ ...current, draft: '', evidenceId: undefined, location: undefined }))
        await reload()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to post to feed')
      }
    },
  }), [apiBase, gameId, characterId, joinDraft, source, screenData.composer, gameSource])

  return { screenData, handlers, loading, error, reload, joined }
}

export function useHostScreenData(
  apiBase: string,
  gameId: string | null,
  hostKey: string | null,
) {
  const source = readGameSourceModeFromLocation()
  const gameSource = getGameSource(source)
  const [screenData, setScreenData] = useState<ScreenData>(emptyScreenData)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (!gameId || !hostKey) return
    upsertHostLink({ gameId, apiBase, hostKey })
  }, [apiBase, gameId, hostKey])

  const reload = async () => {
    if (!gameId || !hostKey) return
    setLoading(true)
    setError('')
    try {
      const game = await gameSource.fetchHostGame(apiBase, gameId, hostKey)
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
          reveals: current.objectives.reveals,
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
          await gameSource.postHostAction(apiBase, gameId, hostKey, 'start')
        } else if (actionId === 'next') {
          await gameSource.postHostAction(apiBase, gameId, hostKey, 'next-act')
        } else if (actionId === 'end') {
          const who = window.prompt('Who did it?')?.trim()
          const how = window.prompt('How was it done?')?.trim()
          const why = window.prompt('Why did it happen?')?.trim()
          if (!who || !how || !why) {
            setLoading(false)
            return
          }
          await gameSource.postEndNight(apiBase, gameId, hostKey, { who, how, why })
        } else if (actionId === 'finish') {
          await gameSource.postHostAction(apiBase, gameId, hostKey, 'done')
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
