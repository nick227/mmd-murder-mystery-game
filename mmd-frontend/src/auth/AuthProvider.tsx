import { createContext, useEffect, useRef, useState, ReactNode } from 'react'

/** Must match API: auth routes registered under /api/v1 */
const AUTH_BASE = '/api/v1/auth'

export interface User {
  id: string // Google sub
  email: string
  name: string
  avatar: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: () => Promise<User | null>
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

type GoogleAccounts = {
  accounts: {
    id: {
      initialize: (opts: object) => void
      prompt: (moment?: (notification: GooglePromptMomentNotification) => void) => void
    }
  }
}

function getGoogle(): GoogleAccounts | undefined {
  return (window as unknown as { google?: GoogleAccounts }).google
}

type GooglePromptMomentNotification = {
  isDisplayMoment?: () => boolean
  isDisplayed?: () => boolean
  isNotDisplayed?: () => boolean
  getNotDisplayedReason?: () => string
  isSkippedMoment?: () => boolean
  getSkippedReason?: () => string
  isDismissedMoment?: () => boolean
  getDismissedReason?: () => string
}

function logGoogleDebug(message: string, details?: Record<string, unknown>) {
  if (!import.meta.env.DEV) return
  console.info(`[google-auth] ${message}`, details ?? {})
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const googleInitializedRef = useRef(false)
  const loginResolverRef = useRef<((user: User | null) => void) | null>(null)
  const loginPromiseRef = useRef<Promise<User | null> | null>(null)
  const loginTimeoutRef = useRef<number | null>(null)

  const clearLoginTimeout = () => {
    if (loginTimeoutRef.current) {
      window.clearTimeout(loginTimeoutRef.current)
      loginTimeoutRef.current = null
    }
  }

  const settleLogin = (nextUser: User | null) => {
    clearLoginTimeout()
    loginResolverRef.current?.(nextUser)
    loginResolverRef.current = null
    loginPromiseRef.current = null
  }

  useEffect(() => {
    if (user) settleLogin(user)
  }, [user])

  useEffect(() => {
    let cancelled = false
    let initPoller: number | null = null

    const checkAuthStatus = async () => {
      try {
        const res = await fetch(`${AUTH_BASE}/me`, { credentials: 'include' })
        if (cancelled) return
        if (res.status === 401) {
          setUser(null)
        } else if (res.ok) {
          setUser((await res.json()) as User)
        }
      } catch {
        // not logged in
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }

    void checkAuthStatus()

    const initGoogle = () => {
      if (googleInitializedRef.current) return
      const google = getGoogle()
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      if (!google?.accounts?.id || !clientId) return

      logGoogleDebug('Initializing Google Sign-In', {
        origin: window.location.origin,
        clientId,
      })

      googleInitializedRef.current = true
      google.accounts.id.initialize({
        client_id: clientId,
        callback: async (response: { credential: string }) => {
          try {
            const res = await fetch(`${AUTH_BASE}/google`, {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: response.credential }),
            })

            if (res.ok) {
              const nextUser = (await res.json()) as User
              setUser(nextUser)
              settleLogin(nextUser)
            } else {
              settleLogin(null)
            }
          } catch (error) {
            console.error('Auth error:', error)
            settleLogin(null)
          }
        },
      })
      // No auto One Tap on mount — avatar uses login() to prompt (clearer UX, fewer duplicate prompts)
    }

    const scheduleInitPolling = () => {
      if (initPoller !== null) return
      initPoller = window.setInterval(() => {
        if (googleInitializedRef.current) return
        initGoogle()
      }, 250)
      window.setTimeout(() => {
        if (initPoller !== null) {
          window.clearInterval(initPoller)
          initPoller = null
        }
      }, 15000)
    }

    if (getGoogle()) {
      initGoogle()
    } else {
      const script = document.querySelector('script[src="https://accounts.google.com/gsi/client"]')
      script?.addEventListener('load', initGoogle, { once: true })
      scheduleInitPolling()
    }

    return () => {
      cancelled = true
      clearLoginTimeout()
      loginResolverRef.current = null
      loginPromiseRef.current = null
      if (initPoller !== null) {
        window.clearInterval(initPoller)
        initPoller = null
      }
    }
  }, [])

  const login = async () => {
    const e2eEnabled =
      import.meta.env.VITE_E2E === 'true' ||
      new URLSearchParams(window.location.search).get('e2e') === '1'

    if (e2eEnabled) {
      try {
        const res = await fetch(`${AUTH_BASE}/dev-login`, {
          method: 'POST',
          credentials: 'include',
        })
        if (!res.ok) return null
        const nextUser = (await res.json()) as User
        setUser(nextUser)
        settleLogin(nextUser)
        return nextUser
      } catch {
        return null
      }
    }

    const google = getGoogle()
    if (!google?.accounts?.id) {
      console.warn('Google Sign-In script not loaded yet; wait a moment and try again')
      return null
    }
    if (!googleInitializedRef.current) {
      const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
      if (clientId) {
        google.accounts.id.initialize({
          client_id: clientId,
          callback: async (response: { credential: string }) => {
            try {
              const res = await fetch(`${AUTH_BASE}/google`, {
                method: 'POST',
                credentials: 'include',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ token: response.credential }),
              })

              if (res.ok) {
                const nextUser = (await res.json()) as User
                setUser(nextUser)
                settleLogin(nextUser)
              } else {
                settleLogin(null)
              }
            } catch (error) {
              console.error('Auth error:', error)
              settleLogin(null)
            }
          },
        })
        googleInitializedRef.current = true
      }
    }
    if (user) return user
    if (loginPromiseRef.current) return loginPromiseRef.current
    logGoogleDebug('Prompting Google Sign-In', {
      origin: window.location.origin,
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
    })
    const loginPromise = new Promise<User | null>(resolve => {
      loginResolverRef.current = resolve
      clearLoginTimeout()
      loginTimeoutRef.current = window.setTimeout(() => {
        settleLogin(null)
      }, 10000)
      google.accounts.id.prompt(notification => {
        if (notification.isNotDisplayed?.()) {
          logGoogleDebug('Google prompt not displayed', {
            reason: notification.getNotDisplayedReason?.(),
          })
          settleLogin(null)
          return
        }
        if (notification.isSkippedMoment?.()) {
          logGoogleDebug('Google prompt skipped', {
            reason: notification.getSkippedReason?.(),
          })
          settleLogin(null)
          return
        }
        if (notification.isDismissedMoment?.()) {
          logGoogleDebug('Google prompt dismissed', {
            reason: notification.getDismissedReason?.(),
          })
        }
      })
    })
    loginPromiseRef.current = loginPromise
    return await loginPromise
  }

  const logout = async () => {
    try {
      await fetch(`${AUTH_BASE}/logout`, {
        method: 'POST',
        credentials: 'include',
      })
      setUser(null)
    } catch (error) {
      console.error('Logout error:', error)
    }
  }

  return (
    <AuthContext.Provider value={{ user, isLoading, login, logout }}>
      {children}
    </AuthContext.Provider>
  )
}

export { AuthContext }
