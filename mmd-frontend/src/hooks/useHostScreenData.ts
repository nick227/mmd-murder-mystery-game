import { useEffect, useMemo, useRef, useState } from 'react'
import { getGameSource, readGameSourceModeFromLocation } from '../data/sources/getGameSource'
import { subscribeHostRoomStream } from '../data/api'
import { emptyScreenData } from '../data/mock'
import type { RendererHandlers, ScreenData } from '../data/types'
import { HOST_POLL_INTERVAL, TIMING } from './polling'
import { buildHostScreen } from './screenBuilders'
import { exportStoryCardsAsPdf, exportStoryCardsAsZip } from '../features/storyCardExport/storyCardExport'

function getHostPollInterval(state: ScreenData['game']['state'], streamConnected: boolean): number {
  const intervals = HOST_POLL_INTERVAL
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

function scrollToComposer() {
  // Find the composer panel and scroll it into view
  const composerPanel = document.querySelector('[dataUi="ComposerPanel"]')
  if (composerPanel) {
    composerPanel.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }
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
  const [exportError, setExportError] = useState('')
  const [streamConnected, setStreamConnected] = useState(false)
  const [exportingActionId, setExportingActionId] = useState<string | null>(null)
  const [exportProgress, setExportProgress] = useState<{ completed: number; total: number }>({ completed: 0, total: 0 })
  const queuedPushReloadRef = useRef<number | null>(null)

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
    }, TIMING.SILENT_RELOAD_DEBOUNCE)
  }

  const reloadInternal = async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!gameId || !hostKey) return
    if (!silent) setLoading(true)
    if (!silent) setError('')
    try {
      const game = await gameSource.fetchHostGame(apiBase, gameId, hostKey)
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
      getHostPollInterval(screenData.game.state, streamConnected),
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
      if (actionId === 'download-cards' || actionId === 'download-cards-pdf') {
        setExportError('')
        setExportingActionId(actionId)
        setExportProgress({ completed: 0, total: 0 })
        try {
          const fetchedGame = await gameSource.fetchHostGame(apiBase, gameId, hostKey)
          const fullStory = await gameSource.fetchStoryById(apiBase, fetchedGame.storyId)
          const exportFn = actionId === 'download-cards-pdf' ? exportStoryCardsAsPdf : exportStoryCardsAsZip
          await exportFn({
            storyId: fetchedGame.storyId,
            storyTitle: fullStory.title || fetchedGame.storyTitle || screenData.hostInfo?.storyTitle || 'story',
            raw: fullStory.dataJson,
            onProgress: (completed, total) => {
              setExportProgress({ completed, total })
            },
          })
        } catch (err) {
          setExportError(err instanceof Error ? err.message : 'Card export failed')
        } finally {
          setExportingActionId(null)
          setExportProgress({ completed: 0, total: 0 })
        }
        return
      }

      setLoading(true)
      setError('')
      try {
        if (actionId === 'player-links') {
          return
        } else if (actionId === 'start') {
          await gameSource.postHostAction(apiBase, gameId, hostKey, 'start')
        } else if (actionId === 'next') {
          await gameSource.postHostAction(apiBase, gameId, hostKey, 'next-act')
        } else if (actionId === 'reveal') {
          await gameSource.postEndNight(apiBase, gameId, hostKey, {
            who: 'Revealed by host',
            how: 'Revealed by host',
            why: 'Revealed by host',
          })
          // Scroll to composer to witness the sequential reveal
          setTimeout(() => scrollToComposer(), 300)
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
  }), [apiBase, gameId, hostKey, screenData.game.act, screenData.hostInfo, gameSource])

  const reload = async () => reloadInternal()

  const nextScreenData =
    exportingActionId
      ? {
          ...screenData,
          gameActions: screenData.gameActions.map(item =>
            item.id === exportingActionId
              ? {
                  ...item,
                  label: (() => {
                    const prefix = exportingActionId === 'download-cards-pdf' ? 'Building PDF...' : 'Exporting cards...'
                    return exportProgress.total > 0
                      ? `${prefix} ${exportProgress.completed} / ${exportProgress.total}`
                      : prefix
                  })(),
                  disabled: true,
                }
              : { ...item, disabled: item.disabled || Boolean(exportingActionId) },
          ),
        }
      : screenData

  return { screenData: nextScreenData, handlers, loading, error: exportError || error, reload }
}
