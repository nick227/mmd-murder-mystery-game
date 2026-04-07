# Games History Analysis

## Overview
This document explains how the game history system works, data sources, and the relationship with user authentication.

## Data Sources

### 1. API Games (Server-Side)
**Location**: Database via `/api/v1/games` endpoint
**Purpose**: Public games created by all users
**Storage**: Prisma/Database
**Pagination**: ✅ Server-side pagination supported
**Fields**:
```typescript
interface ApiGameSummary {
  id: string
  storyId: string | null
  storyFile: string | null
  name: string
  creatorUserId?: string | null
  creatorName?: string | null
  creatorAvatar?: string | null
  scheduledTime: string
  startedAt: string | null
  state: GameState
  currentAct: number
  locationText: string | null
  createdAt: string
  updatedAt: string
}
```

### 2. Stored Games (Client-Side)
**Location**: Browser localStorage (`mmd:links:v1`)
**Purpose**: User's personal game access history
**Storage**: Local browser storage
**Pagination**: ❌ No pagination (all stored games shown)
**Fields**:
```typescript
interface StoredGameLink {
  gameId: string
  apiBase: string
  hostKey?: string
  characterIds: string[]
  story?: {
    id: string | null
    title?: string
    summary?: string
    image?: string
  }
  lastSeenAt: string
}
```

## Data Flow Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   API Games     │    │   Stored Games   │    │   Stories List  │
│  (Database)     │    │  (localStorage)  │    │   (API)         │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌─────────────────┐
                    │ mergeLauncherGames│
                    │   (Utility)      │
                    └─────────────────┘
                                 │
                    ┌─────────────────┐
                    │  LauncherCard   │
                    │   (Component)   │
                    └─────────────────┘
```

## Current Implementation Details

### API Endpoint
**Route**: `GET /api/v1/games`
**Pagination**: `?limit=20&offset=0`
**Ordering**: 
```typescript
orderBy: [
  { state: 'asc' },           // SCHEDULED first
  { scheduledTime: 'desc' },  // Newest within state
  { createdAt: 'desc' }       // Newest creation as tiebreaker
]
```

### Frontend Data Merging
**Function**: `mergeLauncherGames(data)`
**Process**:
1. Creates map of stories by ID
2. Processes API games with story enrichment
3. Merges stored games (personal history)
4. Applies sorting logic (active games first, newest first)

### Display Logic
```typescript
// Separate games by source
const apiGameIds = new Set(data.allGames.map(g => g.id))
const apiGames = mergedGames.filter(g => apiGameIds.has(g.id))
const storedGamesOnly = mergedGames.filter(g => !apiGameIds.has(g.id))

// Final display: paginated API games + all stored games
const displayedGames = [...apiGames, ...storedGamesOnly]
```

## User Authentication Impact

### Current State: ❌ NO USER AUTHENTICATION
- **Game History**: Not tied to user accounts
- **API Games**: Shows all public games regardless of user
- **Stored Games**: Browser-specific (not cross-device)
- **Ownership**: Uses `ownerUserId` but no authentication to verify

### Google Auth Integration (Planned)
**Impact on Game History**:
1. **User-Specific Games**: Filter API games by `ownerUserId`
2. **Cross-Device Sync**: Move stored games to database
3. **Personal History**: Server-side game access tracking
4. **Permissions**: Verify game ownership before showing

## Issues & Limitations

### Current Problems
1. **Mixed Data Sources**: API + localStorage creates complexity
2. **No User Context**: Shows all games, not user-specific
3. **Cross-Device**: Stored games don't sync across devices
4. **Data Inconsistency**: Stored games lack `name`/`state` fields

### Pagination Issues
- **API Games**: ✅ Properly paginated (20 initial, 10 more)
- **Stored Games**: ❌ No pagination (all shown)
- **Total Count**: Can exceed expected limits

## Recommended Improvements

### Phase 1: Fix Current Issues
1. **Standardize Data**: Ensure stored games have required fields
2. **Better Separation**: Clearly distinguish API vs stored games
3. **UI Indicators**: Show which games are from which source

### Phase 2: User Authentication Integration
1. **User-Specific API**: Filter games by authenticated user
2. **Server-Side History**: Move stored games to database
3. **Cross-Device Sync**: User history follows user account

### Phase 3: Enhanced Features
1. **Game States**: Better filtering by game state
2. **Search**: Search within user's game history
3. **Export**: Allow users to export game history

## Database Schema Considerations

### Current Game Table
```sql
Game {
  id: String (PK)
  storyFile: String
  storyId: String (FK to Story)
  name: String
  ownerUserId: String (FK to User) - ❌ Not enforced
  creatorName: String
  creatorAvatar: String
  scheduledTime: DateTime
  startedAt: DateTime?
  state: GameState
  currentAct: Int
  locationText: String?
  createdAt: DateTime
  updatedAt: DateTime
}
```

### Proposed UserGameHistory Table
```sql
UserGameHistory {
  id: String (PK)
  userId: String (FK to User)
  gameId: String (FK to Game)
  apiBase: String
  hostKey: String?
  characterIds: String[]
  lastAccessedAt: DateTime
  createdAt: DateTime
  updatedAt: DateTime
}
```

## Security & Privacy

### Current State
- **Public Access**: Anyone can see all games
- **No Ownership**: No verification of game ownership
- **Local Storage**: Stored games accessible only on same device

### With Google Auth
- **User Isolation**: Users only see their own games
- **Ownership Verification**: Verify `ownerUserId` matches authenticated user
- **Cross-Device Privacy**: User history protected by authentication

## Performance Considerations

### Current Performance
- **API Games**: ✅ Efficient with pagination
- **Stored Games**: ❌ Potential performance issue with many games
- **Merging**: O(n) complexity with game count

### Optimization Strategies
1. **Database Indexing**: Add indexes on `ownerUserId`, `state`, `scheduledTime`
2. **Caching**: Cache user game history
3. **Lazy Loading**: Load stored games on demand
4. **Background Sync**: Sync localStorage to database periodically

## Migration Strategy

### Step 1: Maintain Compatibility
- Keep current API endpoints
- Add user authentication as optional layer
- Gradually migrate stored games to database

### Step 2: User Migration
- Create user accounts for existing game owners
- Migrate localStorage games to UserGameHistory table
- Update frontend to use authenticated endpoints

### Step 3: Cleanup
- Remove localStorage dependency
- Deprecate old unauthenticated endpoints
- Implement proper user-scoped game history

## Conclusion

The current game history system is a hybrid approach that combines server-side API games with client-side stored games. While functional, it has limitations around user context, cross-device synchronization, and data consistency.

The planned Google authentication integration will significantly improve the system by providing proper user context, enabling cross-device synchronization, and allowing for more sophisticated game history features.

Key priorities:
1. Fix current pagination and display issues
2. Implement user authentication
3. Migrate to server-side game history
4. Add user-specific filtering and features
