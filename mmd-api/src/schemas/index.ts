import { z } from 'zod'

// ── Enums ────────────────────────────────────────────────────────────────────

export const GameStateSchema = z.enum(['SCHEDULED', 'PLAYING', 'REVEAL', 'DONE', 'CANCELLED'])
export const TrackSchema = z.enum(['who', 'how', 'why'])

// ── Story schemas ─────────────────────────────────────────────────────────────

export const StoryListItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  summary: z.string(),
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
  scheduledTime: z.string().datetime(),
  startedAt: z.string().datetime().nullable(),
  state: GameStateSchema,
  currentAct: z.number().int(),
  locationText: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export const GameHostViewSchema = GameSchema.extend({
  hostKey: z.string(),
  storyTitle: z.string().optional(),
  players: z.array(HostPlayerSchema),
  feed: z.array(z.any()).optional(),
})

// ── Player schemas ────────────────────────────────────────────────────────────

export const JoinGameBodySchema = z.object({
  playerName: z.string().min(1, 'playerName is required'),
})

export const PlayerViewSchema = z.object({
  gameId: z.string(),
  gameName: z.string(),
  gameState: GameStateSchema,
  currentAct: z.number().int(),
  scheduledTime: z.string().datetime(),
  locationText: z.string().nullable(),
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

export const MoveTypeSchema = z.enum(['suspect', 'accuse', 'alibi', 'share_clue', 'searched', 'solved'])

export const PostMoveBodySchema = z.object({
  characterId: z.string().min(1, 'characterId is required'),
  moveType: MoveTypeSchema,
  text: z.string().optional(),
  targetCharacterId: z.string().optional(),
})

// ── Host action schemas ───────────────────────────────────────────────────────

export const AdvanceActBodySchema = z.object({}).optional()

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
