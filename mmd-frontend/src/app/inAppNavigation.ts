/** Dispatched after `history.pushState` so hooks that read `window.location` re-render. */
export const IN_APP_NAVIGATE_EVENT = 'mmd:in-app-navigate'

/**
 * Same-origin SPA navigation without full page reload (avoids white flash before CSS/JS load).
 * External origins fall back to `window.location.assign`.
 */
export function navigateInApp(pathnameAndSearch: string) {
  const normalized = pathnameAndSearch.startsWith('http')
    ? pathnameAndSearch
    : `${window.location.origin}${pathnameAndSearch.startsWith('/') ? '' : '/'}${pathnameAndSearch}`
  const next = new URL(normalized)
  if (next.origin !== window.location.origin) {
    window.location.assign(next.href)
    return
  }
  window.history.pushState({}, '', `${next.pathname}${next.search}`)
  window.dispatchEvent(new Event(IN_APP_NAVIGATE_EVENT))
}

/** Return to launcher, preserving `api` query when present. */
export function navigateToLauncher() {
  const api = new URLSearchParams(window.location.search).get('api')
  navigateInApp(api ? `/?api=${encodeURIComponent(api)}` : '/')
}

/** Same-origin absolute URLs → SPA; otherwise full navigation. */
export function navigateInAppFromHref(href: string) {
  try {
    const u = new URL(href, window.location.origin)
    if (u.origin !== window.location.origin) {
      window.location.assign(u.href)
      return
    }
    navigateInApp(`${u.pathname}${u.search}`)
  } catch {
    window.location.assign(href)
  }
}

/** Close sheet first, then navigate after paint frame to ensure sheet closes before navigation. */
export function closeThenNavigate(close: () => void, path: string) {
  close()
  requestAnimationFrame(() => navigateInApp(path))
}
