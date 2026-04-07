import { z } from 'zod'

// ── Enums ────────────────────────────────────────────────────────────────────

export const GameStateSchema = z.enum(['SCHEDULED', 'PLAYING', 'REVEAL', 'DONE', 'CANCELLED'])
export const TrackSchema = z.enum(['who', 'how', 'why'])

// ── Story schemas ─────────────────────────────────────────────────────────────

export const StoryListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
  image: z.string().optional(),
  storyMeta: z.array(z.object({
    key: z.string(),
    value: z.string(),
  })).optional(),
  characterCount: z.number().int().nonnegative().optional(),
  cardCount: z.number().int().nonnegative().optional(),
  clueCount: z.number().int().nonnegative().optional(),
  puzzleCount: z.number().int().nonnegative().optional(),
  secretCount: z.number().int().nonnegative().optional(),
  characters: z.array(z.object({
    characterId: z.string(),
    name: z.string(),
    archetype: z.string().optional(),
    portrait: z.string().optional(),
  })).optional(),
  createdAt: z.string().datetime(),
})

export const StorySchema = StoryListItemSchema.extend({
  dataJson: z.any(),
  updatedAt: z.string().datetime(),
})

// ── Game schemas ──────────────────────────────────────────────────────────────

export const CreateGameBodySchema = z.object({
  // Hybrid story source: storyFile is the JSON filename in mmd-api/json.
  storyFile: z.string().min(1).optional(),
  // Legacy / future DB stories
  storyId: z.string().min(1).optional(),
  name: z.string().min(1, 'name is required'),
  scheduledTime: z.string().datetime('must be ISO datetime'),
  locationText: z.string().optional(),
}).refine(
  v => Boolean(v.storyFile || v.storyId),
  { message: 'Either storyFile or storyId is required' },
)

export const RescheduleGameBodySchema = z.object({
  scheduledTime: z.string().datetime('must be ISO datetime'),
})

export const UpdateScheduledGameBodySchema = z.object({
  name: z.string().min(1, 'name is required'),
  scheduledTime: z.string().datetime('must be ISO datetime'),
  locationText: z.string().min(1, 'locationText is required'),
})

const HostPlayerSchema = z.object({
  id: z.string(),
  characterId: z.string(),
  characterName: z.string().nullable().optional(),
  portrait: z.string().nullable().optional(),
  playerName: z.string().nullable(),
  loginKey: z.string(),
  joinedAt: z.string().datetime().nullable(),
})

export const GameSchema = z.object({
  id: z.string(),
  storyId: z.string().nullable(),
  storyFile: z.string().nullable(),
  name: z.string(),
  creatorUserId: z.string().nullable().optional(),
  creatorName: z.string().nullable().optional(),
  creatorAvatar: z.string().nullable().optional(),
  scheduledTime: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  state: GameStateSchema,
  currentAct: z.number().int(),
  locationText: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  joinedCharacterIds: z.array(z.string()).optional(),
})

export const GameHostViewSchema = GameSchema.extend({
  hostKey: z.string(),
  storyTitle: z.string().optional(),
  players: z.array(HostPlayerSchema),
  feed: z.array(z.any()).optional(),
})

// Public game view (no secrets; used for rejoin + story card)
export const PublicGameCharacterSchema = z.object({
  characterId: z.string(),
  name: z.string(),
  archetype: z.string().optional(),
  portrait: z.string().optional(),
  joined: z.boolean().optional(),
})

export const GamePublicViewSchema = z.object({
  gameId: z.string(),
  gameName: z.string(),
  gameState: GameStateSchema,
  creatorUserId: z.string().nullable().optional(),
  creatorName: z.string().nullable().optional(),
  creatorAvatar: z.string().nullable().optional(),
  scheduledTime: z.string().datetime(),
  locationText: z.string().nullable(),
  story: z.object({
    id: z.string(),
    title: z.string(),
    summary: z.string(),
    image: z.string().nullable().optional(),
    characters: z.array(PublicGameCharacterSchema),
  }),
})

// ── Player schemas ────────────────────────────────────────────────────────────

export const JoinGameBodySchema = z.object({
  playerName: z.string().min(1, 'playerName is required'),
})

export const PlayerViewSchema = z.object({
  gameId: z.string(),
  gameName: z.string(),
  storyId: z.string().optional(),
  creatorName: z.string().nullable().optional(),
  storyTitle: z.string().optional(),
  storyBlurb: z.string().optional(),
  gameState: GameStateSchema,
  currentAct: z.number().int(),
  scheduledTime: z.string().datetime(),
  locationText: z.string().nullable(),
  storyImage: z.string().nullable().optional(),
  stage: z.object({
    title: z.string().optional(),
    text: z.string().optional(),
    image: z.string().optional(),
  }).nullable().optional(),
  feed: z.array(z.any()).optional(),
  roomPlayers: z.array(z.object({
    id: z.string(),
    characterId: z.string(),
    characterName: z.string().nullable().optional(),
    portrait: z.string().nullable().optional(),
    playerName: z.string().nullable(),
    joinedAt: z.string().datetime().nullable(),
  })).default([]),
  playerId: z.string(),
  characterId: z.string(),
  playerName: z.string().nullable(),
  character: z.any(),
  visibleInfoCards: z.array(z.any()).optional(),
  visibleItems: z.array(z.any()).optional(),
  visibleHostSpeech: z.array(z.any()).optional(),
  visibleTreasures: z.array(z.any()).optional(),
  unlockedMysteries: z.array(z.any()),
  unlockedPuzzles: z.array(z.any()),
  unlockedCards: z.array(z.any()),
  mysteryAnswers: z.array(z.object({
    track: TrackSchema,
    answer: z.string(),
  })).optional(),
})

export const SubmitObjectiveBodySchema = z.object({
  objectiveId: z.string().min(1, 'objectiveId is required'),
})

export const SubmitCardBodySchema = z.object({
  characterId: z.string().min(1, 'characterId is required'),
  cardId: z.string().min(1, 'cardId is required'),
  act: z.number().int(),
})

export const PostMovePayloadSchema = z.object({
  type: z.literal('POST_MOVE'),
  text: z.string().min(1, 'text is required'),
  clientRequestId: z.string().min(1, 'clientRequestId is required'),
  characterId: z.string().min(1, 'characterId is required'),
  characterName: z.string().min(1, 'characterName is required'),
  characterPortrait: z.string().min(1).optional(),
})

export const PostMoveBodySchema = PostMovePayloadSchema

// ── Host action schemas ───────────────────────────────────────────────────────

export const SubmitAnswersBodySchema = z.object({
  who: z.string().min(1, 'who is required'),
  how: z.string().min(1, 'how is required'),
  why: z.string().min(1, 'why is required'),
})

export const MysteryAnswerSchema = z.object({
  id: z.string(),
  gameId: z.string(),
  track: TrackSchema,
  answer: z.string(),
  enteredAt: z.string().datetime(),
})

// ── Assign character schema ───────────────────────────────────────────────────

export const AssignCharacterBodySchema = z.object({
  characterId: z.string().min(1, 'characterId is required'),
})

// ── Generic response schemas ──────────────────────────────────────────────────

export const MessageSchema = z.object({
  message: z.string(),
})

export const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
  statusCode: z.number(),
})

// ── Type exports ──────────────────────────────────────────────────────────────

export type GameState = z.infer<typeof GameStateSchema>
export type Track = z.infer<typeof TrackSchema>
export type CreateGameBody = z.infer<typeof CreateGameBodySchema>
export type JoinGameBody = z.infer<typeof JoinGameBodySchema>
export type SubmitAnswersBody = z.infer<typeof SubmitAnswersBodySchema>
export type AssignCharacterBody = z.infer<typeof AssignCharacterBodySchema>
