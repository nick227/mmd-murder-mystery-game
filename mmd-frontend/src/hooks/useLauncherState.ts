import { useEffect, useMemo, useState } from 'react'
import { useAuth } from './useAuth'
import { defaultLauncherData, emptyScreenData } from '../data/mock'
import { getGameSource, readGameSourceModeFromLocation } from '../data/sources/getGameSource'
import type { RendererHandlers, ScreenData, TabId } from '../data/types'
import { IN_APP_NAVIGATE_EVENT, navigateInApp } from '../app/inAppNavigation'
import { TIMING } from './polling'

const INITIAL_LOAD_LIMIT = 5

function readQuery(name: string) {
  return new URLSearchParams(window.location.search).get(name)
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

export function useTabState(defaultTab: TabId) {
  const [activeTab, setActiveTab] = useState<TabId>(defaultTab)
  return [activeTab, setActiveTab] as const
}

export function useLauncherState() {
  const { user } = useAuth()
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
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMoreGames, setHasMoreGames] = useState(true)
  const [currentGamesCount, setCurrentGamesCount] = useState(0)

  useEffect(() => {
    const apiBase = screenData.launcher?.apiBase ?? ''
    let cancelled = false
    let timeoutId: number | null = null

    const load = async (attempt: number) => {
      if (attempt === 0) setLoading(true)
      if (attempt === 0) setError('')

      try {
        const [stories, games] = await Promise.all([
          gameSource.fetchStories(apiBase), 
          user ? gameSource.fetchMyGames(apiBase, { limit: INITIAL_LOAD_LIMIT, offset: 0 })
            : Promise.resolve([])
        ])
        if (cancelled) return
        
        setCurrentGamesCount(games.length)
        setHasMoreGames(games.length === INITIAL_LOAD_LIMIT)

        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? {
                ...current.launcher,
                stories,
                allGames: games,
                loadingMore,
                hasMoreGames,
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

        if (attempt < TIMING.MAX_RETRY_ATTEMPTS) {
          timeoutId = window.setTimeout(() => void load(attempt + 1), TIMING.RETRY_DELAY)
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
  }, [screenData.launcher?.apiBase, source, user])

  const handlers: RendererHandlers = useMemo(() => ({
    onLoadMoreGames: async () => {
      if (loadingMore || !hasMoreGames || !user) return
      const apiBase = screenData.launcher?.apiBase ?? ''
      
      setLoadingMore(true)
      try {
        const moreGames = await gameSource.fetchMyGames(apiBase, { 
          limit: INITIAL_LOAD_LIMIT, 
          offset: currentGamesCount 
        })
        
        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? { 
                ...current.launcher, 
                allGames: [...current.launcher.allGames, ...moreGames],
                loadingMore: false,
                hasMoreGames: moreGames.length === INITIAL_LOAD_LIMIT
              }
            : current.launcher,
        }))
        
        setCurrentGamesCount(prev => prev + moreGames.length)
        setHasMoreGames(moreGames.length === INITIAL_LOAD_LIMIT)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load more games')
        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? { ...current.launcher, loadingMore: false }
            : current.launcher,
        }))
      } finally {
        setLoadingMore(false)
      }
    },
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
          setScreenData(current => ({
            ...current,
            launcher: current.launcher && current.launcher.activeGamePublicKey === key
              ? { ...current.launcher, activeGamePublic: publicGame }
              : current.launcher,
          }))
        } catch {
          // Ignore
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
                  allGames: [
                    {
                      id: game.id,
                      storyId: game.storyId,
                      name: game.name,
                      creatorUserId: game.creatorUserId ?? null,
                      creatorName: game.creatorName ?? null,
                      creatorAvatar: game.creatorAvatar ?? null,
                      scheduledTime: game.scheduledTime,
                      startedAt: game.startedAt,
                      state: game.state,
                      currentAct: game.currentAct,
                      locationText: game.locationText ?? null,
                      createdAt: game.createdAt,
                      updatedAt: game.updatedAt,
                      hostKey: game.hostKey,
                      joinedCharacters: [],
                    },
                    ...(current.launcher.allGames ?? []).filter(existing => existing.id !== game.id),
                  ],
                }
              : current.launcher,
          }))
          setCurrentGamesCount(prev => prev + 1)
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

        const games = await (user ? gameSource.fetchMyGames(input.apiBase, { limit: INITIAL_LOAD_LIMIT, offset: 0 })
            : gameSource.fetchGames(input.apiBase, { limit: INITIAL_LOAD_LIMIT, offset: 0 }))
        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? { ...current.launcher, allGames: games }
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
        const games = await (user ? gameSource.fetchMyGames(launcher.apiBase, { limit: INITIAL_LOAD_LIMIT, offset: 0 })
            : Promise.resolve([]))
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
          user ? gameSource.fetchMyGames(launcher.apiBase, { limit: INITIAL_LOAD_LIMIT, offset: 0 })
            : Promise.resolve([]),
        ])
        setScreenData(current => ({
          ...current,
          launcher: current.launcher
            ? {
                ...current.launcher,
                stories,
                allGames: games,
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
  }), [screenData.launcher, user, gameSource])

  return { screenData, handlers, loading, error, loadingMore, hasMoreGames }
}
