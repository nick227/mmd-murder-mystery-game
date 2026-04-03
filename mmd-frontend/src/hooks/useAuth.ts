import { useContext } from 'react'
import { AuthContext, User } from '../auth/AuthProvider'

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}

export type { User }
