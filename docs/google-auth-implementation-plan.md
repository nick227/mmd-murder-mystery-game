# Google Authentication Implementation Plan

## Current State Analysis

### Existing Auth Structure
- **No authentication system** currently implemented
- **Mock user avatar** in `SiteHeader.tsx` with placeholder SVG
- **User props interface** ready in SiteHeader component
- **RoomContext** exists for game state management
- **No auth providers** or context managers
- **No auth-related dependencies** in package.json

### Entry Points for Auth Integration
1. **SiteHeader Component** (`src/components/site/SiteHeader.tsx`)
   - Avatar click handler (currently placeholder)
   - User props interface ready
   - Mobile menu integration point

2. **AppController** (`src/app/AppController.tsx`)
   - Main app state management
   - Can pass auth context to children

3. **RoomContext** (`src/app/roomContext.tsx`)
   - Game-specific state management
   - Could extend for user auth state

## Google OAuth Integration Architecture

### 1. Dependencies Required
```json
{
  "dependencies": {
    "@google-cloud/oauth2": "^4.1.0",
    "google-auth-library": "^9.0.0"
  }
}
```

### 2. File Structure
```
src/
├── auth/
│   ├── google/
│   │   ├── GoogleAuth.ts          # Google OAuth client
│   │   ├── GoogleAuthContext.tsx  # Auth context provider
│   │   └── GoogleAuthButton.tsx # Login button component
│   ├── AuthProvider.tsx          # Main auth provider
│   ├── useAuth.ts              # Auth hook
│   └── types.ts               # Auth-related types
├── components/
│   └── site/
│       ├── SiteHeader.tsx        # Update with real auth
│       └── UserMenu.tsx         # User dropdown menu
└── utils/
    └── auth.ts                # Auth utilities
```

### 3. Google OAuth Flow
1. **Client Setup**: Initialize Google OAuth with client ID
2. **Login Flow**: 
   - Click avatar → Show Google login
   - Redirect to Google consent
   - Handle OAuth callback
   - Store tokens securely
3. **Token Management**:
   - Access token (1 hour)
   - Refresh token (long-term)
   - Secure storage (localStorage/secure storage)
4. **User Data**:
   - Profile info (name, email, avatar)
   - Google ID for user identification

## Credential Storage & Security

### 1. Google Credentials Location
```
mmd-frontend/
├── google-credentials.json     # Google OAuth credentials (LOCAL ONLY)
└── .env                    # Environment variables
```

### 2. Security Measures
- **Client-side only**: No server secrets in frontend
- **Public Google OAuth**: Use public client ID
- **Token storage**: Secure localStorage with encryption
- **Token refresh**: Automatic refresh handling
- **Session management**: Proper logout/cleanup

### 3. Environment Variables
```bash
# .env
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_GOOGLE_REDIRECT_URI=http://localhost:5173/auth/callback
```

## Implementation Steps

### Phase 1: Foundation
1. Add Google auth dependencies
2. Create auth types and interfaces
3. Set up Google OAuth client
4. Create AuthProvider context
5. Update .gitignore for credentials

### Phase 2: Integration
1. Create GoogleAuthButton component
2. Update SiteHeader with real auth
3. Add user menu dropdown
4. Implement login/logout flow
5. Add user profile storage

### Phase 3: Advanced Features
1. Token refresh handling
2. Error boundaries for auth
3. Loading states
4. Offline auth state
5. User preferences storage

## Code Entry Points

### 1. SiteHeader Integration
```typescript
// src/components/site/SiteHeader.tsx
import { useAuth } from '../../hooks/useAuth'

export function SiteHeader({ user, onBrandClick }: SiteHeaderProps) {
  const { user: authUser, login, logout, isLoading } = useAuth()
  
  const handleAvatarClick = () => {
    if (authUser) {
      // Show user menu
    } else {
      // Trigger Google login
      login()
    }
  }
  
  // Render real user avatar or login button
}
```

### 2. Auth Provider Setup
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

### 3. Google OAuth Client
```typescript
// src/auth/google/GoogleAuth.ts
import { OAuth2Client } from 'google-auth-library'

export class GoogleAuth {
  private client: OAuth2Client
  
  constructor() {
    this.client = new OAuth2Client({
      clientId: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      redirectUri: import.meta.env.VITE_GOOGLE_REDIRECT_URI
    })
  }
  
  async initiateLogin(): Promise<string> {
    // Generate auth URL and redirect
  }
  
  async handleCallback(code: string): Promise<UserProfile> {
    // Exchange code for tokens and user profile
  }
}
```

## Google JSON Credentials Setup

### 1. Google Console Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable Google+ API and Google OAuth2 API
4. Create OAuth 2.0 Client ID
5. Add authorized redirect URIs:
   - Development: `http://localhost:5173/auth/callback`
   - Production: `https://yourdomain.com/auth/callback`
6. Download JSON credentials

### 2. Local Credential Storage
```json
// google-credentials.json (LOCAL ONLY - DO NOT COMMIT)
{
  "web": {
    "client_id": "your_google_client_id.apps.googleusercontent.com",
    "client_secret": "your_client_secret",
    "auth_uri": "https://accounts.google.com/o/oauth2/auth",
    "token_uri": "https://oauth2.googleapis.com/token",
    "redirect_uris": ["http://localhost:5173/auth/callback"]
  }
}
```

## .gitignore Updates

Add to existing `.gitignore`:
```gitignore
# --- Google Credentials ---
google-credentials.json
*.google.json
google-oauth-credentials.json

# --- Auth Tokens ---
auth-tokens.json
*.auth-token
```

## Security Considerations

### 1. Client-Side Security
- Never expose client secret in production
- Use HTTPS in production
- Implement proper CORS
- Validate tokens on API calls

### 2. Token Storage
- Use secure localStorage alternatives
- Implement token expiration
- Clear tokens on logout
- Handle token refresh gracefully

### 3. Privacy
- Request minimal Google permissions
- Clear user data on logout
- Implement data export for GDPR compliance
- Provide privacy policy

## Testing Strategy

### 1. Unit Tests
- Auth context behavior
- Token storage/retrieval
- Login/logout flows
- Error handling

### 2. Integration Tests
- Full OAuth flow simulation
- User profile loading
- Avatar display updates
- Mobile menu interactions

### 3. E2E Tests
- Login from SiteHeader
- Game access with auth
- Logout functionality
- Cross-browser compatibility

## Timeline Estimate

- **Phase 1**: 2-3 days (Foundation)
- **Phase 2**: 3-4 days (Integration)
- **Phase 3**: 2-3 days (Advanced features)
- **Total**: 7-10 days

## Next Steps

1. **Immediate**: Add dependencies and update .gitignore
2. **Day 1**: Create auth types and Google client
3. **Day 2**: Implement AuthProvider and useAuth hook
4. **Day 3**: Update SiteHeader with real auth integration
5. **Day 4**: Add user menu and login flow
6. **Day 5**: Testing and refinement
