import { useEffect, useRef, useState } from 'react'
import { useAuth } from './useAuth'
import { buildPlayerScreenModel } from '../data/screenData/playerScreenModel'
import { getGameSource, readGameSourceModeFromLocation } from '../data/sources/getGameSource'
import { subscribePlayerRoomStream } from '../data/api'
import { emptyScreenData } from '../data/mock'
import type { FeedItem, PlayerApiView, PostMovePayload, RendererHandlers, ScreenData } from '../data/types'
import { IN_APP_NAVIGATE_EVENT, navigateInApp } from '../app/inAppNavigation'
import { POLL_INTERVAL, TIMING } from './polling'
import { optimisticComposerItem, readClientRequestId, filterPendingComposerPosts, mergeFeedWithOptimistic, OptimisticComposerPost } from './optimisticComposer'
import { exportStoryCardsAsPdf, exportStoryCardsAsZip } from '../features/storyCardExport/storyCardExport'

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

function getPlayerPollInterval(state: ScreenData['game']['state'], streamConnected: boolean): number {
  const intervals = POLL_INTERVAL
  if (streamConnected) {
    switch (state) {
      case 'PLAYING': return intervals.PLAYING.STREAM_CONNECTED
      case 'SCHEDULED': return intervals.SCHEDULED.STREAM_CONNECTED
      case 'REVEAL': return intervals.REVEAL.STREAM_CONNECTED
      case 'DONE': return intervals.DONE.STREAM_CONNECTED
      case 'CANCELLED': return intervals.CANCELLED.STREAM_CONNECTED
      default: return intervals.SCHEDULED.STREAM_CONNECTED
    }
  }
  switch (state) {
    case 'PLAYING': return intervals.PLAYING.POLL_ONLY
    case 'SCHEDULED': return intervals.SCHEDULED.POLL_ONLY
    case 'REVEAL': return intervals.REVEAL.POLL_ONLY
    case 'DONE': return intervals.DONE.POLL_ONLY
    case 'CANCELLED': return intervals.CANCELLED.POLL_ONLY
    default: return intervals.SCHEDULED.POLL_ONLY
  }
}

export function usePlayerScreenData(
  apiBase: string,
  gameId: string | null,
  characterId: string | null,
) {
  const source = readGameSourceModeFromLocation()
  const gameSource = getGameSource(source)
  const { user } = useAuth()
  const [screenData, setScreenData] = useState<ScreenData>(emptyScreenData)
  const [view, setView] = useState<PlayerApiView | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [exportError, setExportError] = useState('')
  const [streamConnected, setStreamConnected] = useState(false)
  const [exportingActionId, setExportingActionId] = useState<string | null>(null)
  const [exportProgress, setExportProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 })
  const queuedPushReloadRef = useRef<number | null>(null)
  const [joinDraft, setJoinDraft] = useState('')
  const [optimisticComposerPosts, setOptimisticComposerPosts] = useState<OptimisticComposerPost[]>([])
  const composerDraftRef = useRef('')
  const isSendingComposerRef = useRef(false)
  const optimisticComposerPostsRef = useRef<OptimisticComposerPost[]>([])
  const screenDataRef = useRef(screenData)
  const requestIdRef = useRef(0)

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
    }, TIMING.SILENT_RELOAD_DEBOUNCE)
  }

  useEffect(() => {
    if (!gameId || !characterId) {
      setLoading(false)
      setError('')
      setScreenData(emptyScreenData)
      setView(null)
      setJoinDraft('')
      setOptimisticComposerPosts([])
      return
    }
    setLoading(true)
    setError('')
  }, [apiBase, gameId, characterId])

  const reloadInternal = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!gameId || !characterId) return
    const reqId = ++requestIdRef.current
    if (!silent) setLoading(true)
    if (!silent) setError('')
    try {
      const view = await gameSource.fetchPlayerViewByCharacter(apiBase, gameId, characterId)
      if (reqId !== requestIdRef.current) return
      const base = buildPlayerScreenModel(view, joinDraft)
      const acknowledgedRequestIds = new Set(
        (view.feed ?? [])
          .map(readClientRequestId)
          .filter((value): value is string => Boolean(value)),
      )
      const pendingComposerPosts = filterPendingComposerPosts(
        optimisticComposerPostsRef.current,
        acknowledgedRequestIds,
      )
      if (pendingComposerPosts.length !== optimisticComposerPostsRef.current.length) {
        setOptimisticComposerPosts(pendingComposerPosts)
      }
      setScreenData(current => {
        const draft = current.composer?.draft ?? ''
        return {
          ...base,
          feed: mergeFeedWithOptimistic(base.feed, pendingComposerPosts),
          composer: {
            ...base.composer,
            ...current.composer,
            draft,
            canSend: Boolean(draft.trim().length),
          },
        }
      })
      setView(view)
    } catch (err) {
      if (reqId !== requestIdRef.current) return
      setError(err instanceof Error ? err.message : 'Failed to load game')
    } finally {
      if (reqId !== requestIdRef.current) return
      if (!silent) setLoading(false)
    }
  }

  useEffect(() => {
    if (!gameId || !characterId) return
    let active = true
    let timeoutId: number | null = null

    const tick = async () => {
      if (!active) return
      await reloadInternal({ silent: true })
      if (!active) return
      if (streamConnected) return
      const interval = getPlayerPollInterval(screenData.game.state, streamConnected)
      if (!active) return
      timeoutId = window.setTimeout(tick, interval)
    }

    void reloadInternal()
    timeoutId = window.setTimeout(tick, getPlayerPollInterval(screenData.game.state, streamConnected))

    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void reloadInternal({ silent: true })
      }
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      active = false
      if (timeoutId !== null) window.clearTimeout(timeoutId)
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

  const handlers: RendererHandlers = {
    onDownloadStoryCards: async ({ storyId, storyTitle }) => {
      setExportError('')
      setExportingActionId('download-cards')
      setExportProgress({ completed: 0, total: 0 })
      try {
        const fullStory = await gameSource.fetchStoryById(apiBase, storyId)
        await exportStoryCardsAsZip({
          storyId,
          storyTitle: storyTitle || fullStory.title || 'story',
          raw: fullStory.dataJson,
          onProgress: (completed, total) => setExportProgress({ completed, total }),
        })
      } catch (err) {
        setExportError(err instanceof Error ? err.message : 'Card export failed')
      } finally {
        setExportingActionId(null)
        setExportProgress({ completed: 0, total: 0 })
      }
    },
    onDownloadStoryCardsPdf: async ({ storyId, storyTitle }) => {
      setExportError('')
      setExportingActionId('download-cards-pdf')
      setExportProgress({ completed: 0, total: 0 })
      try {
        const fullStory = await gameSource.fetchStoryById(apiBase, storyId)
        await exportStoryCardsAsPdf({
          storyId,
          storyTitle: storyTitle || fullStory.title || 'story',
          raw: fullStory.dataJson,
          onProgress: (completed, total) => setExportProgress({ completed, total }),
        })
      } catch (err) {
        setExportError(err instanceof Error ? err.message : 'PDF export failed')
      } finally {
        setExportingActionId(null)
        setExportProgress({ completed: 0, total: 0 })
      }
    },
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
      setJoinDraft(value)
      setScreenData(current => ({
        ...current,
        join: current.join ? { ...current.join, playerName: value } : current.join,
      }))
    },
    onJoinSubmit: async () => {
      const playerName = joinDraft.trim() || (user?.name ?? '')
      if (!gameId || !characterId || !playerName) return
      setLoading(true)
      setError('')
      try {
        await gameSource.joinPlayerByCharacter(apiBase, gameId, characterId, playerName)
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

      const identity = currentCharacterIdentity({ screenData, characterId })
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
  }

  const reload = async () => reloadInternal()

  const joined = Boolean(view?.playerName)
  const nextScreenData =
    exportingActionId
      ? {
          ...screenData,
          gameActions: screenData.gameActions.map(item =>
            item.id === exportingActionId
              ? {
                  ...item,
                  label: exportProgress.total > 0
                    ? `${exportingActionId === 'download-cards-pdf' ? 'Building PDF...' : 'Exporting cards...'} ${exportProgress.completed} / ${exportProgress.total}`
                    : (exportingActionId === 'download-cards-pdf' ? 'Building PDF...' : 'Exporting cards...'),
                  disabled: true,
                }
              : { ...item, disabled: item.disabled || Boolean(exportingActionId) },
          ),
        }
      : screenData

  return { screenData: nextScreenData, handlers, loading, error: exportError || error, reload, joined }
}
