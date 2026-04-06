import { useEffect, useState } from 'react'
import { IN_APP_NAVIGATE_EVENT } from '../app/inAppNavigation'

export { useTabState, useLauncherState } from './useLauncherState'
export { usePlayerScreenData } from './usePlayerScreenData'
export { useHostScreenData } from './useHostScreenData'

export type ViewMode =
  | { mode: 'launcher'; apiBase: string; gameId: null; characterId: null; hostKey: null }
  | { mode: 'room'; apiBase: string; gameId: string; characterId: string; hostKey: string | null }
  | { mode: 'host'; apiBase: string; gameId: string; characterId: null; hostKey: string }
  | { mode: 'play'; apiBase: string; gameId: string; characterId: string; hostKey: string | null }

function parseRoute(): ViewMode {
  const url = new URL(window.location.href)
  const parts = url.pathname.split('/').filter(Boolean)
  const apiBase = url.searchParams.get('api') ?? ''
  const hostKey = url.searchParams.get('hostKey')

  if (parts[0] === 'room' && parts[1] && parts[2]) {
    return { mode: 'room', apiBase, gameId: parts[1], characterId: parts[2], hostKey }
  }

  if (parts[0] === 'host' && parts[1]) {
    if (!hostKey) {
      return { mode: 'launcher', apiBase, gameId: null, characterId: null, hostKey: null }
    }
    return { mode: 'host', apiBase, gameId: parts[1], characterId: null, hostKey }
  }

  if (parts[0] === 'play' && parts[1] && parts[2]) {
    return { mode: 'play', apiBase, gameId: parts[1], characterId: parts[2], hostKey }
  }

  return { mode: 'launcher', apiBase, gameId: null, characterId: null, hostKey: null }
}

export function useViewMode(): ViewMode {
  const [route, setRoute] = useState<ViewMode>(() => parseRoute())
  const [isPlayRedirected, setIsPlayRedirected] = useState(false)

  useEffect(() => {
    const onNav = () => setRoute(parseRoute())
    window.addEventListener('popstate', onNav)
    window.addEventListener(IN_APP_NAVIGATE_EVENT, onNav)
    return () => {
      window.removeEventListener('popstate', onNav)
      window.removeEventListener(IN_APP_NAVIGATE_EVENT, onNav)
    }
  }, [])

  useEffect(() => {
    if (route.mode === 'play' && !isPlayRedirected) {
      setIsPlayRedirected(true)
      const url = new URL(window.location.href)
      const newPath = `/room/${route.gameId}/${route.characterId}`
      const query = url.search ? url.search : ''
      window.history.replaceState({}, '', `${newPath}${query}`)
      setRoute({ mode: 'room', apiBase: route.apiBase, gameId: route.gameId, characterId: route.characterId, hostKey: route.hostKey })
    }
  }, [route, isPlayRedirected])

  return route
}

