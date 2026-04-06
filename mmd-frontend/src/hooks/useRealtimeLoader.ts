import { useEffect, useRef, useState, useCallback } from 'react'
import { TIMING } from './polling'

export interface UseRealtimeLoaderOptions<T> {
  fetch: () => Promise<T>
  subscribe: (onEvent: () => void, onStatusChange: (status: 'connected' | 'disconnected') => void) => () => void
  getPollInterval: (state: unknown, streamConnected: boolean) => number
  enabled: boolean
}

export interface UseRealtimeLoaderResult<T> {
  reload: (opts?: { silent?: boolean }) => Promise<void>
  streamConnected: boolean
}

export function useRealtimeLoader<T>(options: UseRealtimeLoaderOptions<T>): UseRealtimeLoaderResult<T> {
  const { fetch, subscribe, getPollInterval, enabled } = options
  
  const [streamConnected, setStreamConnected] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [gameState, setGameState] = useState<unknown>(null)
  
  const queuedReloadRef = useRef<number | null>(null)
  const fetchRef = useRef(fetch)
  const getPollIntervalRef = useRef(getPollInterval)
  
  useEffect(() => {
    fetchRef.current = fetch
  }, [fetch])
  
  useEffect(() => {
    getPollIntervalRef.current = getPollInterval
  }, [getPollInterval])

  const reloadInternal = useCallback(async (opts?: { silent?: boolean }) => {
    const silent = Boolean(opts?.silent)
    if (!silent) {
      setLoading(true)
      setError('')
    }
    try {
      const result = await fetchRef.current()
      // Extract game state for polling interval - implementation specific
      if (result && typeof result === 'object' && 'game' in result) {
        setGameState((result as { game: unknown }).game)
      }
    } catch (err) {
      if (!silent) {
        setError(err instanceof Error ? err.message : 'Failed to load')
      }
    } finally {
      if (!silent) {
        setLoading(false)
      }
    }
  }, [])

  const queueSilentReload = useCallback(() => {
    if (queuedReloadRef.current !== null) return
    queuedReloadRef.current = window.setTimeout(() => {
      queuedReloadRef.current = null
      void reloadInternal({ silent: true })
    }, TIMING.SILENT_RELOAD_DEBOUNCE)
  }, [reloadInternal])

  // Polling effect
  useEffect(() => {
    if (!enabled) return
    
    void reloadInternal()
    
    const interval = window.setInterval(
      () => void reloadInternal({ silent: true }),
      getPollInterval(gameState, streamConnected),
    )
    
    return () => {
      window.clearInterval(interval)
    }
  }, [enabled, gameState, streamConnected, getPollInterval, reloadInternal])

  // Visibility change effect
  useEffect(() => {
    if (!enabled) return
    
    const onVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        void reloadInternal({ silent: true })
      }
    }
    
    document.addEventListener('visibilitychange', onVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [enabled, reloadInternal])

  // Stream subscription effect
  useEffect(() => {
    if (!enabled) return
    
    const cleanup = subscribe(
      queueSilentReload,
      status => setStreamConnected(status === 'connected'),
    )
    
    return cleanup
  }, [enabled, subscribe, queueSilentReload])

  // Cleanup queued reload on unmount
  useEffect(() => {
    return () => {
      if (queuedReloadRef.current !== null) {
        window.clearTimeout(queuedReloadRef.current)
      }
    }
  }, [])

  const reload = useCallback(() => reloadInternal(), [reloadInternal])

  return { reload, streamConnected }
}
