import { useEffect, useMemo, useRef, useState } from 'react'
import { buildPlayerScreenModel } from '../data/screenData/playerScreenModel'
import { mapApiEventToProgressFeedItem } from '../data/screenData/playerScreenModel'
import { defaultLauncherData, emptyScreenData } from '../data/mock'
import { getGameSource, readGameSourceModeFromLocation } from '../data/sources/getGameSource'
import { subscribeHostRoomStream, subscribePlayerRoomStream } from '../data/api'
import { storyHeroImage } from '../utils/storyHeroImage'
import { readStoredGames } from '../data/runningGamesRegistry'
import type {
  FeedItem,
  HostApiGame,
  PostMovePayload,
  RendererHandlers,
  ScreenData,
  TabId,
} from '../data/types'
import { upsertCreatedGame, upsertGameStory, upsertHostLink, upsertPlayerLink } from '../data/runningGamesRegistry'
import { IN_APP_NAVIGATE_EVENT, navigateInApp } from '../app/inAppNavigation'

/** Must match mmd-api `HOST_RUNTIME_MAX_ACT` — last act before host must call end-night. */
const HOST_RUNTIME_MAX_ACT = 5

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

function playerPollIntervalMs(state: ScreenData['game']['state'], streamConnected: boolean) {
  if (streamConnected) {
    switch (state) {
      case 'PLAYING':
        return 20000
      case 'SCHEDULED':
      case 'REVEAL':
        return 30000
      case 'DONE':
      case 'CANCELLED':
        return 60000
      default:
        return 30000
    }
  }
  switch (state) {
    case 'PLAYING':
      return 3000
    case 'SCHEDULED':
    case 'REVEAL':
      return 5000
    case 'DONE':
    case 'CANCELLED':
      return 15000
    default:
      return 5000
  }
}

function hostPollIntervalMs(state: ScreenData['game']['state'], streamConnected: boolean) {
  if (streamConnected) {
    switch (state) {
      case 'PLAYING':
        return 15000
      case 'SCHEDULED':
      case 'REVEAL':
        return 20000
      case 'DONE':
      case 'CANCELLED':
        return 60000
      default:
        return 20000
    }
  }
  switch (state) {
    case 'PLAYING':
      return 3000
    case 'SCHEDULED':
    case 'REVEAL':
      return 5000
    case 'DONE':
    case 'CANCELLED':
      return 15000
    default:
      return 5000
  }
}

type OptimisticComposerPost = {
  clientRequestId: string
  item: FeedItem
}

function optimisticComposerItem(input: {
  payload: PostMovePayload
}): FeedItem {
  return {
    id: input.payload.clientRequestId,
    type: 'chat',
    variant: 'social',
    text: input.payload.text,
    author: input.payload.characterName,
    authorPortrait: input.payload.characterPortrait,
    timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
  }
}

function readClientRequestId(event: { payload?: Record<string, unknown> } | null | undefined): string | null {
  const raw = event?.payload?.clientRequestId
  return typeof raw === 'string' && raw.trim().length ? raw : null
}

function currentCharacterIdentity(input: {
  screenData: ScreenData
  characterId: string
}): { id: string; name: string; portrait?: string } {
  const player = input.screenData.players.find(item => item.characterId === input.characterId)
  const name = input.screenData.profile.characterName || player?.name || `Character ${input.characterId}`
  return {
    id: input.characterId,
    name,
    portrait: input.screenData.profile.portrait || player?.portrait || undefined,
  }
}

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
        : game.state === 'PLAYING' && game.currentAct >= HOST_RUNTIME_MAX_ACT
        ? `Final act (${game.currentAct}). Use "End night & reveal truth" to conclude — do not advance further.`
        : `Act ${game.currentAct} is active.`,
    },
  ]

  if (Array.isArray(game.feed) && game.feed.length) {
    feed.push(...game.feed.slice(-20).map(mapApiEventToProgressFeedItem).filter((it): it is FeedItem => Boolean(it)))
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
        : game.state === 'PLAYING' && game.currentAct >= HOST_RUNTIME_MAX_ACT
        ? 'You are on the final act. When discussion is finished, use End night to move to the reveal phase.'
        : 'Everyone is in the game. Advance acts only when the room is ready.',
      image: storyHeroImage(game.stageImage),
      countdownLabel: game.state === 'SCHEDULED' ? countdown.label : undefined,
      countdownPercent: game.state === 'SCHEDULED' ? countdown.percent : undefined,
      banner: game.state === 'SCHEDULED'
        ? 'You are in the host control room.'
        : 'Host controls are live.',
    },
    players: game.players.map(player => ({
      id: player.id,
      name: player.characterName ?? player.playerName ?? `Character ${player.characterId}`,
      joinedName: typeof player.playerName === 'string' && player.playerName.trim().length > 0 ? player.playerName.trim() : undefined,
      characterId: player.characterId,
      online: Boolean(player.joinedAt),
      portrait: typeof player.portrait === 'string' ? player.portrait : undefined,
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
        ? [
            { id: 'player-links', label: 'Player Links', kind: 'secondary' },
            { id: 'start', label: 'Start Game', kind: 'primary' }
          ]
        : game.state === 'PLAYING'
        ? [
            { id: 'player-links', label: 'Player Links', kind: 'secondary' },
            ...(game.currentAct < HOST_RUNTIME_MAX_ACT
              ? [{ id: 'next' as const, label: `Next Act (${game.currentAct + 1})`, kind: 'primary' as const }]
              : []),
            {
              id: 'reveal',
              label: game.currentAct >= HOST_RUNTIME_MAX_ACT ? 'End night & reveal truth' : 'Reveal Truth',
              kind: game.currentAct >= HOST_RUNTIME_MAX_ACT ? 'primary' : 'secondary',
            },
          ]
        : game.state === 'REVEAL'
        ? [
            { id: 'player-links', label: 'Player Links', kind: 'secondary' },
            { id: 'finish', label: 'End Game', kind: 'primary' }
          ]
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
  const [, bumpRoute] = useState(0)
  useEffect(() => {
    const onNav = () => bumpRoute(n => n + 1)
    window.addEventListener('popstate', onNav)
    window.addEventListener(IN_APP_NAVIGATE_EVENT, onNav)
    return () => {
      window.removeEventListener('popstate', onNav)
      window.removeEventListener(IN_APP_NAVIGATE_EVENT, onNav)
    }
  }, [])

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
    let cancelled = false
    let timeoutId: number | null = null

    const load = async (attempt: number) => {
      if (attempt === 0) setLoading(true)
      if (attempt === 0) setError('')

      try {
        const [stories, games] = await Promise.all([gameSource.fetchStories(apiBase), gameSource.fetchGames(apiBase)])
        if (cancelled) return
        const savedGames = readStoredGames()

        // Enrich saved history rows with story metadata when possible (same API base only).
        // This ensures history sheets can always render the full story card even when
        // the saved row predates story persistence.
        const storiesById = new Map(stories.map(s => [s.id, s] as const))
        const gamesById = new Map(games.map(g => [g.id, g] as const))
        for (const saved of savedGames) {
          if (saved.apiBase !== apiBase) continue
          if (saved.story && (saved.story.id || saved.story.title || saved.story.summary || saved.story.image)) continue
          const g = gamesById.get(saved.gameId)
          if (!g?.storyId) continue
          const story = storiesById.get(g.storyId)
          if (!story) continue
          upsertGameStory({
            gameId: saved.gameId,
            apiBase: saved.apiBase,
            story: { id: story.id, title: story.title, summary: story.summary, image: story.image },
          })
        }

        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? {
                ...current.launcher,
                stories,
                allGames: games,
                savedGames: readStoredGames(),
                form: {
                  ...current.launcher.form,
                  storyId: current.launcher.form.storyId || stories[0]?.id || '',
                },
              }
            : current.launcher,
        }))
        setLoading(false)
      } catch (err) {
        if (cancelled) return
        const message = err instanceof Error ? err.message : 'Failed to load launcher data'
        setError(message)

        // When running `npm run dev` (root), the frontend may start before the API is listening.
        // Retry briefly so the launcher self-heals without requiring a manual refresh.
        if (attempt < 10) {
          timeoutId = window.setTimeout(() => void load(attempt + 1), 1200)
        } else {
          setLoading(false)
        }
      }
    }

    void load(0)

    return () => {
      cancelled = true
      if (timeoutId) window.clearTimeout(timeoutId)
    }
  }, [screenData.launcher?.apiBase, source])

  const handlers: RendererHandlers = useMemo(() => ({
    onLauncherOpenGameDetails: (gameIdToOpen, apiBaseToOpen) => {
      const key = `${apiBaseToOpen}:${gameIdToOpen}`
      setScreenData(current => ({
        ...current,
        launcher: current.launcher
          ? { ...current.launcher, activeGamePublic: null, activeGamePublicKey: key }
          : current.launcher,
      }))
      void (async () => {
        try {
          const publicGame = await gameSource.fetchPublicGame(apiBaseToOpen, gameIdToOpen)
          upsertGameStory({
            gameId: gameIdToOpen,
            apiBase: apiBaseToOpen,
            story: {
              id: publicGame.story.id,
              title: publicGame.story.title,
              summary: publicGame.story.summary,
              image: publicGame.story.image ?? undefined,
            },
          })
          setScreenData(current => ({
            ...current,
            launcher: current.launcher && current.launcher.activeGamePublicKey === key
              ? { ...current.launcher, activeGamePublic: publicGame }
              : current.launcher,
          }))
        } catch {
          // Ignore: history sheet still renders from best-effort saved data.
        }
      })()
    },
    onLauncherSubmitGame: async input => {
      const launcher = screenData.launcher
      if (!launcher) return

      setLoading(true)
      setError('')
      try {
        if (input.mode === 'create') {
          const game = await gameSource.createGame(input.apiBase, {
            storyId: input.storyId,
            name: input.name.trim(),
            scheduledTime: new Date(input.scheduledTime).toISOString(),
            locationText: input.locationText.trim(),
          })
          const story = launcher.stories.find(s => s.id === input.storyId) ?? null
          upsertCreatedGame({
            gameId: game.id,
            apiBase: input.apiBase,
            hostKey: game.hostKey,
            characterIds: game.players.map(p => p.characterId),
            story: story
              ? { id: story.id, title: story.title, summary: story.summary, image: story.image }
              : { id: input.storyId },
          })
          setScreenData(current => ({
            ...current,
            launcher: current.launcher
              ? {
                  ...current.launcher,
                  createdGame: {
                    id: game.id,
                    name: game.name,
                    creatorUserId: game.creatorUserId ?? null,
                    creatorName: game.creatorName ?? null,
                    creatorAvatar: game.creatorAvatar ?? null,
                    hostKey: game.hostKey,
                    scheduledTime: game.scheduledTime,
                    hostUrl: `${window.location.origin}/host/${game.id}?hostKey=${game.hostKey}${input.apiBase ? `&api=${encodeURIComponent(input.apiBase)}` : ''}`,
                    playerLinks: game.players.map(player => ({
                      characterId: player.characterId,
                      label: player.characterName ?? `Character ${player.characterId}`,
                      url: buildPlayerPath(game.id, player.characterId, buildShareQuery({ apiBase: input.apiBase })),
                    })),
                  },
                }
              : current.launcher,
          }))
          const query = new URLSearchParams()
          query.set('hostKey', game.hostKey)
          if (input.apiBase) query.set('api', input.apiBase)
          navigateInApp(`/room/${game.id}/${input.characterId}?${query.toString()}`)
          return
        }

        if (!input.gameId || !input.hostKey) {
          setError('Missing game credentials.')
          return
        }

        await gameSource.updateScheduledGame(input.apiBase, input.gameId, input.hostKey, {
          name: input.name.trim(),
          scheduledTime: new Date(input.scheduledTime).toISOString(),
          locationText: input.locationText.trim(),
        })

        const games = await gameSource.fetchGames(input.apiBase)
        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? { ...current.launcher, allGames: games, savedGames: readStoredGames() }
            : current.launcher,
        }))

        const query = new URLSearchParams()
        query.set('hostKey', input.hostKey)
        if (input.apiBase) query.set('api', input.apiBase)
        navigateInApp(`/room/${input.gameId}/${input.characterId}?${query.toString()}`)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to submit game')
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
  const [streamConnected, setStreamConnected] = useState(false)
  const queuedPushReloadRef = useRef<number | null>(null)
  const [joined, setJoined] = useState(false)
  const [joinDraft, setJoinDraft] = useState('')
  const [optimisticComposerPosts, setOptimisticComposerPosts] = useState<OptimisticComposerPost[]>([])
  const joinDraftRef = useRef('')
  const composerDraftRef = useRef('')
  const isSendingComposerRef = useRef(false)
  const optimisticComposerPostsRef = useRef<OptimisticComposerPost[]>([])
  const screenDataRef = useRef(screenData)

  useEffect(() => {
    joinDraftRef.current = joinDraft
  }, [joinDraft])

  useEffect(() => {
    composerDraftRef.current = screenData.composer?.draft ?? ''
  }, [screenData.composer?.draft])

  useEffect(() => {
    optimisticComposerPostsRef.current = optimisticComposerPosts
  }, [optimisticComposerPosts])

  useEffect(() => {
    screenDataRef.current = screenData
  }, [screenData])

  const queueSilentReload = () => {
    if (queuedPushReloadRef.current !== null) return
    queuedPushReloadRef.current = window.setTimeout(() => {
      queuedPushReloadRef.current = null
      void reloadInternal({ silent: true })
    }, 150)
  }

  useEffect(() => {
    if (!gameId || !characterId) return
    upsertPlayerLink({ gameId, apiBase, characterId })
  }, [apiBase, gameId, characterId])

  useEffect(() => {
    if (!gameId || !characterId) {
      setLoading(false)
      setError('')
      setScreenData(emptyScreenData)
      setJoined(false)
      setJoinDraft('')
      setOptimisticComposerPosts([])
      return
    }
    setLoading(true)
    setError('')
    setScreenData(emptyScreenData)
    setJoined(false)
    setJoinDraft('')
    setOptimisticComposerPosts([])
  }, [apiBase, gameId, characterId])

  const reloadInternal = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!gameId || !characterId) return
    if (!silent) setLoading(true)
    if (!silent) setError('')
    try {
      const view = await gameSource.fetchPlayerViewByCharacter(apiBase, gameId, characterId)
      const base = buildPlayerScreenModel(view, joinDraftRef.current)
      const acknowledgedRequestIds = new Set(
        (view.feed ?? [])
          .map(readClientRequestId)
          .filter((value): value is string => Boolean(value)),
      )
      const pendingComposerPosts = optimisticComposerPostsRef.current.filter(
        post => !acknowledgedRequestIds.has(post.clientRequestId),
      )
      if (pendingComposerPosts.length !== optimisticComposerPostsRef.current.length) {
        setOptimisticComposerPosts(pendingComposerPosts)
      }
      setScreenData(current => {
        const draft = current.composer?.draft ?? ''
        return {
          ...base,
          feed: [...base.feed, ...pendingComposerPosts.map(post => post.item)],
          composer: {
            ...base.composer,
            ...current.composer,
            draft,
            canSend: Boolean(draft.trim().length),
          },
        }
      })
      if (view.playerName) {
        setJoined(true)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load game')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (!gameId || !characterId) return
    void reloadInternal()
    const interval = window.setInterval(
      () => void reloadInternal({ silent: true }),
      playerPollIntervalMs(screenData.game.state, streamConnected),
    )
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void reloadInternal({ silent: true })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [apiBase, gameId, characterId, screenData.game.state, streamConnected])

  useEffect(() => {
    if (!gameId || !characterId) return
    return subscribePlayerRoomStream(
      apiBase,
      gameId,
      characterId,
      queueSilentReload,
      status => setStreamConnected(status === 'connected'),
    )
  }, [apiBase, gameId, characterId])

  useEffect(() => () => {
    if (queuedPushReloadRef.current !== null) {
      window.clearTimeout(queuedPushReloadRef.current)
    }
  }, [])

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
        } catch (err) {
          setScreenData(current => ({
            ...current,
            objectives: {
              ...current.objectives,
              personal: current.objectives.personal.map(item => item.id === objectiveId ? { ...item, completed: !item.completed } : item),
              group: current.objectives.group.map(item => item.id === objectiveId ? { ...item, completed: !item.completed } : item),
              reveals: current.objectives.reveals,
            },
          }))
          setError(err instanceof Error ? err.message : 'Failed to submit objective')
          throw err
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
      const playerName = joinDraftRef.current.trim()
      if (!gameId || !characterId || !playerName) return
      setLoading(true)
      setError('')
      try {
        await gameSource.joinPlayerByCharacter(apiBase, gameId, characterId, playerName)
        setJoined(true)
        await reloadInternal()
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
      setScreenData(current => {
        const next = { ...current.composer, draft: value }
        return { ...current, composer: { ...next, canSend: Boolean(value.trim().length) } }
      })
    },
    onComposerSend: async textInput => {
      if (!gameId || !characterId) return
      const text = textInput.trim()
      if (!text) return
      if (isSendingComposerRef.current) return
      isSendingComposerRef.current = true
      setError('')
      composerDraftRef.current = ''
      const identity = currentCharacterIdentity({ screenData: screenDataRef.current, characterId })
      const clientRequestId = crypto.randomUUID()
      const payload: PostMovePayload = {
        type: 'POST_MOVE',
        text,
        clientRequestId,
        characterId: identity.id,
        characterName: identity.name,
        characterPortrait: identity.portrait,
      }
      const optimisticPost: OptimisticComposerPost = {
        clientRequestId,
        item: optimisticComposerItem({ payload }),
      }

      setOptimisticComposerPosts(current => [...current, optimisticPost])
      setScreenData(current => ({
        ...current,
        feed: [...current.feed, optimisticPost.item],
        composer: { ...current.composer, draft: '', canSend: false },
      }))

      void gameSource.postMove(apiBase, gameId, payload).catch(err => {
        setOptimisticComposerPosts(current => current.filter(post => post.clientRequestId !== clientRequestId))
        setScreenData(current => ({
          ...current,
          feed: current.feed.filter(item => item.id !== optimisticPost.item.id),
          composer: { ...current.composer, draft: current.composer.draft || text, canSend: true },
        }))
        composerDraftRef.current = text
        setError(err instanceof Error ? err.message : 'Failed to post')
      }).finally(() => {
        isSendingComposerRef.current = false
      })
    },
  }), [apiBase, gameId, characterId, source, gameSource])

  const reload = async () => reloadInternal()

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
  const [streamConnected, setStreamConnected] = useState(false)
  const queuedPushReloadRef = useRef<number | null>(null)

  useEffect(() => {
    if (!gameId || !hostKey) return
    upsertHostLink({ gameId, apiBase, hostKey })
  }, [apiBase, gameId, hostKey])

  useEffect(() => {
    if (!gameId || !hostKey) {
      setLoading(false)
      setError('')
      setScreenData(emptyScreenData)
      return
    }
    setLoading(true)
    setError('')
    setScreenData(emptyScreenData)
  }, [apiBase, gameId, hostKey])

  const queueSilentReload = () => {
    if (queuedPushReloadRef.current !== null) return
    queuedPushReloadRef.current = window.setTimeout(() => {
      queuedPushReloadRef.current = null
      void reloadInternal({ silent: true })
    }, 150)
  }

  const reloadInternal = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!gameId || !hostKey) return
    if (!silent) setLoading(true)
    if (!silent) setError('')
    try {
      const game = await gameSource.fetchHostGame(apiBase, gameId, hostKey)
      upsertGameStory({
        gameId,
        apiBase,
        story: { id: game.storyId, title: game.storyTitle ?? undefined },
      })
      setScreenData(buildHostScreen(game, apiBase))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load host view')
    } finally {
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (!gameId || !hostKey) return
    void reloadInternal()
    const interval = window.setInterval(
      () => void reloadInternal({ silent: true }),
      hostPollIntervalMs(screenData.game.state, streamConnected),
    )
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void reloadInternal({ silent: true })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      window.clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [apiBase, gameId, hostKey, screenData.game.state, streamConnected])

  useEffect(() => {
    if (!gameId || !hostKey) return
    return subscribeHostRoomStream(
      apiBase,
      gameId,
      hostKey,
      queueSilentReload,
      status => setStreamConnected(status === 'connected'),
    )
  }, [apiBase, gameId, hostKey])

  useEffect(() => () => {
    if (queuedPushReloadRef.current !== null) {
      window.clearTimeout(queuedPushReloadRef.current)
    }
  }, [])

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
        if (actionId === 'player-links') {
          // This will be handled by the parent component that manages the invite sheet state
          return
        } else if (actionId === 'start') {
          await gameSource.postHostAction(apiBase, gameId, hostKey, 'start')
        } else if (actionId === 'next') {
          await gameSource.postHostAction(apiBase, gameId, hostKey, 'next-act')
        } else if (actionId === 'reveal' || actionId === 'end') {
          const who = window.prompt('Reveal Truth - Who did it?')?.trim()
          const how = window.prompt('Reveal Truth - How was it done?')?.trim()
          const why = window.prompt('Reveal Truth - Why did it happen?')?.trim()
          if (!who || !how || !why) {
            setLoading(false)
            return
          }
          await gameSource.postEndNight(apiBase, gameId, hostKey, { who, how, why })
        } else if (actionId === 'finish') {
          await gameSource.postHostAction(apiBase, gameId, hostKey, 'done')
        }
        await reloadInternal()
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

  const reload = async () => reloadInternal()

  return { screenData, handlers, loading, error, reload }
}
