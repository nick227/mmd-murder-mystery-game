# Google Auth MVP Implementation Plan

## Architecture (Simplified MVP)

**Frontend**: Google popup → ID token (JWT) → POST `/auth/google`  
**Backend**: Verify token → create/find user → session cookie

## Implementation Time: ~30-45 minutes

---

## Frontend Implementation

### 1. Add Google Script
```html
<!-- In index.html or App.tsx -->
<script src="https://accounts.google.com/gsi/client" async defer></script>
```

### 2. Environment Variables
```bash
# mmd-frontend/.env
VITE_GOOGLE_CLIENT_ID=560459192625-7o6esoud8fnutpgiobil4lplk96al15s.apps.googleusercontent.com
```

### 3. AuthProvider.tsx
```typescript
// src/auth/AuthProvider.tsx
import { createContext, useContext, useEffect, useState } from 'react'

interface User {
  id: string      // Google sub
  email: string
  name: string
  avatar: string
}

interface AuthContextType {
  user: User | null
  isLoading: boolean
  login: () => void
  logout: () => void
}

const AuthContext = createContext<AuthContextType | null>(null)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Check if user is logged in on mount
    checkAuthStatus()
    
    // Initialize Google One Tap safely
    const initGoogle = () => {
      if (!window.google || !import.meta.env.VITE_GOOGLE_CLIENT_ID) return
      
      window.google.accounts.id.initialize({
        client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
        callback: async (response) => {
          try {
            const res = await fetch('/auth/google', {
              method: 'POST',
              credentials: 'include', // Critical for session cookies
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ token: response.credential })
            })
            
            if (res.ok) {
              const user = await res.json()
              setUser(user) // Instant UI update, no reload
            }
          } catch (error) {
            console.error('Auth error:', error)
          }
        }
      })
      
      // Optional: Auto-login returning users
      window.google.accounts.id.prompt()
    }

    // Safer script loading
    if (window.google) {
      initGoogle()
    } else {
      window.onload = initGoogle
    }
  }, [])

  // Add to checkAuthStatus
  try {
    const res = await fetch('/auth/me', {
      credentials: 'include' // Critical for session cookies
    })
    if (res.ok) {
      const userData = await res.json()
        setUser(userData)
    }
  } catch (error) {
    // Not logged in
  } finally {
    setIsLoading(false)
  }

  const login = () => {
    if (window.google) {
      window.google.accounts.id.prompt()
    }
  }

  const logout = async () => {
    try {
      await fetch('/auth/logout', {
        method: 'POST',
        credentials: 'include' // Critical for session cookies
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

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
```

### 4. Update SiteHeader.tsx
```typescript
// src/components/site/SiteHeader.tsx
import { useAuth } from '../../auth/AuthProvider'

export function SiteHeader({ user, onBrandClick }: SiteHeaderProps) {
  const { user: authUser, login, logout, isLoading } = useAuth()

  const handleAvatarClick = () => {
    if (authUser) {
      // Show user menu or logout
      logout()
    } else {
      login()
    }
  }

  return (
    <header className="site-header">
      {/* ... existing branding code ... */}
      
      <div className="site-header__user">
        <button 
          className="site-header__avatar"
          onClick={handleAvatarClick}
          disabled={isLoading}
          aria-label={authUser ? "User menu" : "Login"}
        >
          {authUser?.avatar ? (
            <img 
              src={authUser.avatar} 
              alt={authUser.name} 
              className="site-header__avatar-img"
            />
          ) : (
            <div className="site-header__avatar-placeholder">
              {isLoading ? (
                <div className="loading-spinner" />
              ) : (
                <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
                </svg>
              )}
            </div>
          )}
        </button>
      </div>
    </header>
  )
}
```

### 5. Update AppController.tsx
```typescript
// src/app/AppController.tsx
import { AuthProvider } from '../auth/AuthProvider'

export function AppController() {
  return (
    <AuthProvider>
      {/* Existing app content */}
    </AuthProvider>
  )
}
```

---

## Backend Implementation

### 1. Add Dependencies
```bash
cd mmd-api
npm install google-auth-library
npm install @types/express-session -D
```

### 2. Environment Variables
```bash
# mmd-api/.env
GOOGLE_CLIENT_ID=your_google_client_id
SESSION_SECRET=your_session_secret
```

### 3. Add User Model to Prisma
```prisma
// mmd-api/prisma/schema.prisma
model User {
  id        String   @id // Google sub
  email     String   @unique
  name      String
  avatar    String
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt

  games Game[] // User's created games

  @@map("users")
}

// Update Game model
model Game {
  // ... existing fields ...
  ownerUserId String
  ownerUser   User   @relation(fields: [ownerUserId], references: [id])
  
  @@map("games")
}
```

### 4. Create Auth Routes
```typescript
// mmd-api/src/routes/auth.ts
import { FastifyInstance } from 'fastify'
import { OAuth2Client } from 'google-auth-library'

const client = new OAuth2Client(process.env.GOOGLE_CLIENT_ID)

export async function authRoutes(fastify: FastifyInstance) {
  // Verify Google ID token and create/find user
  fastify.post('/auth/google', async (request, reply) => {
    const { token } = request.body as { token: string }

    try {
      const ticket = await client.verifyIdToken({
        idToken: token,
        audience: process.env.GOOGLE_CLIENT_ID
      })

      const payload = ticket.getPayload()
      if (!payload) {
        return reply.status(400).send({ error: 'Invalid token' })
      }

      const userId = payload.sub // Google's stable unique ID
      const email = payload.email!
      const name = payload.name!
      const avatar = payload.picture!

      // Create or find user
      const user = await fastify.prisma.user.upsert({
        where: { id: userId },
        update: { email, name, avatar },
        create: { id: userId, email, name, avatar }
      })

      // Set session
      request.session.userId = userId

      reply.send({ ok: true, user: { id: userId, email, name, avatar } })
    } catch (error) {
      fastify.log.error('Google auth error:', error)
      reply.status(400).send({ error: 'Authentication failed' })
    }
  })

  // Get current user
  fastify.get('/auth/me', async (request, reply) => {
    const userId = request.session.userId
    
    if (!userId) {
      return reply.status(401).send({ error: 'Not authenticated' })
    }

    const user = await fastify.prisma.user.findUnique({
      where: { id: userId }
    })

    if (!user) {
      return reply.status(401).send({ error: 'User not found' })
    }

    reply.send({ id: user.id, email: user.email, name: user.name, avatar: user.avatar })
  })

  // Logout
  fastify.post('/auth/logout', async (request, reply) => {
    request.session.destroy()
    reply.send({ ok: true })
  })
}
```

### 5. Add Session Support
```typescript
// mmd-api/src/index.ts
import fastifySession from '@fastify/session'
import { prisma } from './lib/prisma.js'

// Add to buildApp function
await fastify.register(fastifySession, {
  secret: process.env.SESSION_SECRET || 'dev-secret',
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    sameSite: 'lax',
    // Critical: false for dev (localhost), true for prod (HTTPS)
    secure: false
  }
})

// Add auth routes
await fastify.register(authRoutes, { prefix: '/api/v1' })
```

### 6. Update Package.json
```json
{
  "dependencies": {
    "google-auth-library": "^9.0.0",
    "@fastify/session": "^10.0.0"
  }
}
```

---

## Database Migration

```bash
cd mmd-api
npx prisma migrate dev --name add-users
```

---

## Permission Example

```typescript
// Example: Check if user owns a game
const game = await fastify.prisma.game.findUnique({
  where: { id: gameId }
})

if (game?.ownerUserId !== request.session.userId) {
  return reply.status(403).send({ error: 'Access denied' })
}
```

---

## Environment Setup

### Google Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create OAuth 2.0 Client ID
3. Add authorized JavaScript origins:
   - Development: `http://localhost:5173`
   - Production: `https://yourdomain.com`
4. Copy Client ID

### Environment Files
```bash
# mmd-frontend/.env
VITE_GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com

# mmd-api/.env
GOOGLE_CLIENT_ID=your_client_id.apps.googleusercontent.com
SESSION_SECRET=random_secret_string
DATABASE_URL=file:./dev.db
```

---

## Testing

1. **Frontend**: Click avatar → Google login popup → Success
2. **Backend**: Verify token creation in database
3. **Flow**: Login → Check session → Logout → Session cleared

---

## What We Get

✅ Real Google authentication  
✅ Stable user ID (Google sub)  
✅ User permissions (game ownership)  
✅ Zero auth complexity  
✅ Easy to delete/replace later  
✅ Session-based security  
✅ Profile data (name, email, avatar)  

**Total Implementation Time**: 30-45 minutes
