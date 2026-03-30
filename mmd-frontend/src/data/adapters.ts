import type { ApiGameEvent, FeedItem, ObjectiveItem, PlayerApiView, ScreenData } from './types'

export function normaliseFeedEvent(event: ApiGameEvent): FeedItem {
  const payload = event.payload ?? {}
  let text = ''

  switch (event.type) {
    case 'SYSTEM':
    case 'ANNOUNCEMENT':
      text = typeof payload.message === 'string' ? payload.message : event.type
      break
    case 'JOIN': {
      const name = typeof (payload as any).playerName === 'string' ? (payload as any).playerName : null
      const index = typeof (payload as any).playerIndex === 'number' ? (payload as any).playerIndex : null
      text = name ? `${name} joined.` : index !== null ? `Player ${index} joined.` : 'A player joined.'
      break
    }
    case 'SUBMIT_OBJECTIVE': {
      const index = typeof (payload as any).playerIndex === 'number' ? (payload as any).playerIndex : null
      text = index !== null ? `Player ${index} submitted an objective.` : 'A player submitted an objective.'
      break
    }
    case 'START_GAME':
      text = typeof (payload as any).act === 'number' ? `Game started. Act ${(payload as any).act} has begun.` : 'Game started.'
      break
    case 'ADVANCE_ACT':
      text = typeof (payload as any).act === 'number' ? `Act ${(payload as any).act} has begun.` : 'Act advanced.'
      break
    case 'ACT_CHANGED':
      text = typeof payload.act === 'number' ? `Act ${payload.act} has begun.` : 'Act changed.'
      break
    case 'STAGE_UPDATED':
      text = typeof payload.title === 'string' ? `Stage updated: ${payload.title}` : 'Host updated the stage.'
      break
    default:
      text = String(payload.message ?? event.type)
  }

  return {
    id: event.id,
    type: event.type === 'ANNOUNCEMENT' ? 'announcement' : 'system',
    text,
    timestamp: event.createdAt
      ? new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : undefined,
  }
}

export function playerViewToScreenData(
  input: PlayerApiView,
  playerNameDraft: string,
): ScreenData {
  const character = input.character ?? {}
  const characterName = String(character.name ?? `Character ${input.characterId}`)
  const secrets: string[] = Array.isArray(character.secrets) ? (character.secrets as string[]) : []
  const items: string[] = Array.isArray(character.items) ? (character.items as string[]) : []
  const cards: Array<Record<string, unknown>> = Array.isArray(input.unlockedCards) ? input.unlockedCards : []
  const puzzles: Array<Record<string, unknown>> = Array.isArray(input.unlockedPuzzles) ? input.unlockedPuzzles : []

  const instructionCards = cards.filter(card => String(card.type ?? '') === 'instruction')
  const clueCards = cards.filter(card => String(card.type ?? '') === 'clue')

  const roomPlayers = (input.roomPlayers ?? []).map(player => ({
    id: player.id,
    name: player.playerName ?? `Character ${player.characterId}`,
    characterId: player.characterId,
    online: Boolean(player.joinedAt),
  }))

  const feedFromApi = (input.feed ?? []).map(normaliseFeedEvent)
  const revealItems: FeedItem[] = (input.mysteryAnswers ?? []).map(answer => ({
    id: `reveal-${answer.track}`,
    type: 'announcement',
    text: `${answer.track.toUpperCase()}: ${answer.answer}`,
  }))

  const defaultSystem: FeedItem[] = input.gameState === 'SCHEDULED'
    ? [{ id: 'pregame', type: 'system', text: 'Pregame room is open. Guests can join early and wait for the host.' }]
    : []

  const feed = [...defaultSystem, ...feedFromApi, ...revealItems]

  let countdownLabel: string | undefined
  let countdownPercent: number | undefined
  if (input.gameState === 'SCHEDULED') {
    const target = new Date(input.scheduledTime).getTime()
    const diff = target - Date.now()
    if (diff <= 0) {
      countdownLabel = 'Start anytime'
      countdownPercent = 100
    } else {
      const total = 2 * 60 * 60 * 1000
      countdownPercent = Math.max(5, Math.min(100, ((total - Math.min(diff, total)) / total) * 100))
      countdownLabel = `${Math.ceil(diff / 60000)}m until start`
    }
  }

  const stageTitle =
    input.stage?.title
    ?? (input.gameState === 'SCHEDULED'
      ? 'Pregame room'
      : input.gameState === 'REVEAL'
      ? 'Final reveal'
      : `Act ${input.currentAct}`)

  const stageText =
    input.stage?.text
    ?? (input.gameState === 'SCHEDULED'
      ? (input.playerName
        ? 'You are joined. Waiting for the host to start the game.'
        : 'Enter your name to join the room, then wait for the host to begin.')
      : input.gameState === 'REVEAL'
      ? 'The host has ended the night and is revealing the final answers.'
      : `You are in the live game. Follow your cards, message other players, and work the room.`)

  const stageBanner =
    input.gameState === 'SCHEDULED'
      ? `You are ${characterName}. Read your persona and wait for the host to start.`
      : input.gameState === 'REVEAL'
      ? 'The final answers are now visible to all players.'
      : `You are ${characterName}. Stay in character.`

  return {
    game: {
      state: input.gameState,
      act: input.currentAct,
      title: stageTitle,
      subtitle: `${input.gameName} · You are ${characterName}`,
      description: stageText,
      image: input.stage?.image ?? storyHeroImage(input.gameName),
      countdownLabel,
      countdownPercent,
      banner: stageBanner,
    },
    players: roomPlayers,
    feed,
    objectives: {
      personal: instructionCards.map((card, index) => ({
        id: String(card.id ?? `card-${index}`),
        text: String(card.text ?? 'Instruction'),
        completed: false,
        act: typeof card.act === 'number' ? card.act : undefined,
        intent: 'instruction',
      })),
      group: puzzles.map((puzzle, index) => ({
        id: String(puzzle.id ?? `puzzle-${index}`),
        text: String(puzzle.question ?? puzzle.title ?? 'Group clue'),
        completed: false,
        group: true,
        act: typeof puzzle.act === 'number' ? puzzle.act : undefined,
        intent: typeof (puzzle as Record<string, unknown>).intent === 'string'
          ? ((puzzle as Record<string, unknown>).intent as ObjectiveItem['intent'])
          : undefined,
      })),
    },
    profile: {
      characterName,
      archetype: typeof character.archetype === 'string' ? character.archetype : undefined,
      biography: typeof character.biography === 'string' && character.biography.trim().length > 0
        ? character.biography
        : 'Your persona is part of this story. Stay in character and pursue your goals.',
      secrets: secrets.map((value, index) => ({ id: `secret-${index}`, label: 'Secret', value })),
      items: items.map((value, index) => ({ id: `item-${index}`, label: 'Item', value })),
      cards: clueCards.map((card, index) => ({
        id: String(card.id ?? `clue-${index}`),
        label: String(card.title ?? 'Clue'),
        value: String(card.text ?? 'Clue'),
      })),
    },
    composer: {
      mode: 'public',
      draft: '',
      placeholder: 'Messaging persistence is still mocked. UI is live, backend comes next.',
      recipients: roomPlayers
        .filter(player => player.online && player.id !== input.playerId)
        .map(player => ({ id: player.id, label: player.name })),
      canSend: false,
    },
    gameActions: [],
    join: {
      title: 'Join your character',
      subtitle: `Enter your name to join as ${characterName}.`,
      playerName: playerNameDraft,
      submitLabel: 'Join game',
    },
  }
}

function storyHeroImage(title: string): string {
  const key = title.toLowerCase()
  if (key.includes('diamond') || key.includes('hollywood')) {
    return 'https://images.unsplash.com/photo-1519741497674-611481863552?auto=format&fit=crop&w=1200&q=80'
  }
  return 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80'
}
