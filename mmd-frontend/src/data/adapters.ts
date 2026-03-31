import type { ApiGameEvent, EvidenceItem, FeedItem, FeedVariant, ObjectiveItem, PlayerApiView, ScreenData } from './types'
import { storyHeroImage } from '../utils/storyHeroImage'
import { deriveHeatFromEvents, deriveTimelinePinsFromEvents } from '../gameplay/deriveSignals'
import { portraitDataUrl } from '../utils/portrait'
import { buildMoveChips, parseRichTokens } from '../gameplay/richTokens'

export function normaliseFeedEvent(event: ApiGameEvent): FeedItem {
  const payload = event.payload ?? {}
  let text = ''
  let variant: FeedVariant = 'room'
  let media: FeedItem['media'] = undefined
  let actDivider: number | undefined
  let layout: FeedItem['layout'] = 'row'

  switch (event.type) {
    case 'SYSTEM':
    case 'ANNOUNCEMENT':
      text = typeof payload.message === 'string' ? payload.message : event.type
      variant = 'narration'
      break
    case 'JOIN': {
      const name = typeof (payload as any).playerName === 'string' ? (payload as any).playerName : null
      const index = typeof (payload as any).playerIndex === 'number' ? (payload as any).playerIndex : null
      text = name ? `${name} joined` : index !== null ? `Player ${index} joined` : 'Player joined'
      variant = 'room'
      break
    }
    case 'SUBMIT_OBJECTIVE': {
      const index = typeof (payload as any).playerIndex === 'number' ? (payload as any).playerIndex : null
      // Keep trailing period for stable test expectations.
      text = index !== null ? `Player ${index} submitted an objective.` : 'A player submitted an objective.'
      variant = 'mechanic'
      break
    }
    case 'POST_MOVE': {
      const index = typeof (payload as any).playerIndex === 'number' ? (payload as any).playerIndex : null
      const actor = index !== null ? `Player ${index}` : 'A player'
      const moveType = typeof (payload as any).moveType === 'string' ? String((payload as any).moveType) : ''
      const targetName = typeof (payload as any).targetName === 'string' ? String((payload as any).targetName) : null
      const rawTextBody = typeof (payload as any).text === 'string' ? String((payload as any).text) : ''
      const { text: textBody, chips } = parseRichTokens(rawTextBody)

      if (moveType === 'suspect') {
        text = targetName ? `${actor} suspects ${targetName}.` : `${actor} voiced a suspicion.`
      } else if (moveType === 'accuse') {
        text = targetName ? `${actor} accuses ${targetName}.` : `${actor} made an accusation.`
      } else if (moveType === 'alibi') {
        text = textBody ? `${actor} claims an alibi: ${textBody}` : `${actor} claimed an alibi.`
      } else if (moveType === 'share_clue') {
        text = textBody ? `${actor} shared a clue: ${textBody}` : `${actor} shared a clue.`
      } else if (moveType === 'searched') {
        text = textBody ? `${actor} searched: ${textBody}` : `${actor} searched.`
      } else if (moveType === 'solved') {
        text = textBody ? `${actor} solved a puzzle: ${textBody}` : `${actor} solved a puzzle.`
      } else {
        text = textBody ? `${actor}: ${textBody}` : `${actor} posted a move.`
      }

      variant = moveType === 'solved' ? 'mechanic' : 'social'
      const finalChips = buildMoveChips({ moveType, targetName, chips })
      return {
        id: event.id,
        type: 'chat',
        variant,
        chips: finalChips,
        text,
        timestamp: event.createdAt
          ? new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          : undefined,
      }
    }
    case 'START_GAME':
      text = 'Game started'
      variant = 'narration'
      actDivider = 1
      layout = 'cinematic'
      media = typeof (payload as any).stageImage === 'string'
        ? { src: String((payload as any).stageImage), alt: 'Act scene', ratio: '16:9', variant: 'hero', fallback: { type: 'gradient' } }
        : undefined
      break
    case 'ADVANCE_ACT':
      text = typeof (payload as any).act === 'number' ? `Act ${(payload as any).act} started` : 'Act advanced'
      variant = 'narration'
      actDivider = typeof (payload as any).act === 'number' ? Number((payload as any).act) : undefined
      layout = 'cinematic'
      media = typeof (payload as any).stageImage === 'string'
        ? { src: String((payload as any).stageImage), alt: 'Act scene', ratio: '16:9', variant: 'hero', fallback: { type: 'gradient' } }
        : undefined
      break
    case 'ACT_CHANGED':
      text = typeof payload.act === 'number' ? `Act ${payload.act} started` : 'Act changed'
      variant = 'room'
      break
    case 'STAGE_UPDATED':
      text = typeof payload.title === 'string' ? `Stage updated: ${payload.title}` : 'Host updated the stage.'
      variant = 'narration'
      break
    default:
      text = String(payload.message ?? event.type)
      variant = 'room'
  }

  return {
    id: event.id,
    type: event.type === 'ANNOUNCEMENT' ? 'announcement' : 'system',
    variant,
    media,
    layout,
    actDivider,
    text,
    timestamp: event.createdAt
      ? new Date(event.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : undefined,
  }
}

function buildNarrationStacking(input: FeedItem[]): FeedItem[] {
  const isNarration = (it: FeedItem) => (it.variant ?? 'room') === 'narration'
  const out = input.slice()

  for (let i = 0; i < out.length; i++) {
    const cur = out[i]
    if (!isNarration(cur)) continue
    const prev = out[i - 1]
    const next = out[i + 1]
    const prevIsNarration = prev ? isNarration(prev) : false
    const nextIsNarration = next ? isNarration(next) : false
    cur.stacking = prevIsNarration || nextIsNarration
      ? (prevIsNarration && nextIsNarration ? 'mid' : prevIsNarration ? 'end' : 'start')
      : 'solo'
  }

  return out
}

function applyNarrationBlockRule(input: FeedItem[]): FeedItem[] {
  const isNarration = (it: FeedItem) => (it.variant ?? 'room') === 'narration'
  const isRoom = (it: FeedItem) => (it.variant ?? 'room') === 'room'

  const out: FeedItem[] = []
  let i = 0
  while (i < input.length) {
    const current = input[i]
    if (!isNarration(current)) {
      out.push(current)
      i++
      continue
    }

    const narrationBlock: FeedItem[] = []
    const postponedRoom: FeedItem[] = []

    while (i < input.length) {
      const it = input[i]
      if (isNarration(it)) {
        narrationBlock.push(it)
        i++
        continue
      }
      if (isRoom(it)) {
        postponedRoom.push(it)
        i++
        continue
      }
      break
    }

    out.push(...narrationBlock, ...postponedRoom)
  }

  return out
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
  const revealCards = cards.filter(card => String(card.type ?? '') === 'reveal')

  const submittedIds = new Set(
    (input.feed ?? [])
      .filter(e => e.type === 'SUBMIT_OBJECTIVE')
      .map(e => String((e.payload as any)?.cardId ?? ''))
      .filter(Boolean),
  )

  const roomPlayers = (input.roomPlayers ?? []).map(player => ({
    id: player.id,
    name: (player as any).characterName ?? player.playerName ?? `Character ${player.characterId}`,
    characterId: player.characterId,
    online: Boolean(player.joinedAt),
    portrait: typeof (player as any).portrait === 'string' && String((player as any).portrait).trim().length > 0
      ? String((player as any).portrait)
      : portraitDataUrl((player as any).characterName ?? player.playerName ?? `Character ${player.characterId}`),
  }))

  const apiEvents = (input.feed ?? [])
  const feedFromApi = apiEvents.map(normaliseFeedEvent)
  const revealItems: FeedItem[] = (input.mysteryAnswers ?? []).map(answer => ({
    id: `reveal-${answer.track}`,
    type: 'announcement',
    text: `${answer.track.toUpperCase()}: ${answer.answer}`,
  }))

  const defaultSystem: FeedItem[] = input.gameState === 'SCHEDULED'
    ? [{ id: 'pregame', type: 'system', variant: 'room', text: 'Pregame room is open. Guests can join early and wait for the host.' }]
    : []

  const personal: ObjectiveItem[] = instructionCards.map((card, index) => ({
    id: String(card.id ?? `card-${index}`),
    text: String(card.text ?? 'Instruction'),
    completed: submittedIds.has(String(card.id ?? '')),
    act: typeof card.act === 'number' ? card.act : undefined,
    intent: 'instruction',
  }))

  // Guard: [].every(...) is true — only inject when there is at least one game card and all are submitted.
  const doneThisActItem: FeedItem[] =
    input.gameState !== 'SCHEDULED'
    && personal.length > 0
    && personal.every(c => c.completed)
      ? [{ id: 'done-this-act', type: 'system', variant: 'mechanic', text: "You're done for this act — check the room feed." }]
      : []

  const feed = [...defaultSystem, ...doneThisActItem, ...feedFromApi, ...revealItems]
  const feedGrouped = buildNarrationStacking(applyNarrationBlockRule(feed))

  const heat = deriveHeatFromEvents({ events: apiEvents, roomPlayers })
  const timelinePins = deriveTimelinePinsFromEvents({ events: apiEvents })

  // Pregame only: hide spoilers (secrets, clues, inventory, story reveals). In PLAYING / REVEAL / DONE we
  // keep these visible so players can review materials after the game — do not strip on DONE.
  const hidePregameSpoilers = input.gameState === 'SCHEDULED'
  const evidenceView = buildEvidence({
    clues: hidePregameSpoilers ? [] : clueCards,
    puzzles,
    reveals: hidePregameSpoilers ? [] : revealCards,
  })

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
      ? ((input.playerName
        || Boolean((input.roomPlayers ?? []).find(p => p.characterId === input.characterId)?.joinedAt))
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
    feed: feedGrouped,
    view: {
      doNow: personal.filter(o => !o.completed).slice(0, 3),
      evidence: evidenceView,
      heat,
      timeline: timelinePins,
    },
    objectives: {
      personal,
      group: puzzles.map((puzzle, index) => ({
        id: String(puzzle.id ?? `puzzle-${index}`),
        text: String(puzzle.question ?? puzzle.title ?? 'Group clue'),
        completed: submittedIds.has(String(puzzle.id ?? '')),
        group: true,
        act: typeof puzzle.act === 'number' ? puzzle.act : undefined,
        intent: typeof (puzzle as Record<string, unknown>).intent === 'string'
          ? ((puzzle as Record<string, unknown>).intent as ObjectiveItem['intent'])
          : undefined,
      })),
      reveals: hidePregameSpoilers
        ? []
        : revealCards.map((card, index) => ({
          id: String(card.id ?? `reveal-${index}`),
          text: String(card.text ?? 'Reveal'),
          completed: false,
          act: typeof card.act === 'number' ? card.act : undefined,
          intent: 'reveal' as const,
        })),
    },
    profile: {
      characterName,
      archetype: typeof character.archetype === 'string' ? character.archetype : undefined,
      biography: typeof character.biography === 'string' && character.biography.trim().length > 0
        ? character.biography
        : 'Your persona is part of this story. Stay in character and pursue your goals.',
      portrait: typeof (character as any).image === 'string' && String((character as any).image).trim().length > 0
        ? String((character as any).image)
        : portraitDataUrl(characterName),
      secrets: hidePregameSpoilers
        ? []
        : secrets.map((value, index) => ({ id: `secret-${index}`, label: 'Secret', value })),
      items: hidePregameSpoilers
        ? []
        : items.map((value, index) => ({ id: `item-${index}`, label: 'Item', value })),
      cards: hidePregameSpoilers
        ? []
        : clueCards.map((card, index) => ({
          id: String(card.id ?? `clue-${index}`),
          label: String(card.title ?? 'Clue'),
          value: String(card.text ?? 'Clue'),
        })),
    },

    composer: {
      mode: 'public',
      moveType: 'suspect',
      draft: '',
      placeholder: 'Pick a move…',
      recipients: roomPlayers
        .filter(player => player.online && player.id !== input.playerId)
        .map(player => ({ id: player.characterId, label: player.name })),
      evidenceOptions: evidenceView.map(item => ({ id: item.id, label: item.title, image: item.image })),
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

function buildEvidence(input: {
  clues: Array<Record<string, unknown>>
  puzzles: Array<Record<string, unknown>>
  reveals: Array<Record<string, unknown>>
}): EvidenceItem[] {
  const clues: EvidenceItem[] = input.clues.map((card, index) => ({
    id: String(card.id ?? `clue-${index}`),
    kind: 'clue',
    title: String(card.title ?? 'Clue'),
    text: String(card.text ?? 'Clue'),
    act: typeof card.act === 'number' ? card.act : undefined,
    image: typeof (card as any).image === 'string' ? String((card as any).image) : undefined,
  }))

  const puzzles: EvidenceItem[] = input.puzzles.map((puzzle, index) => ({
    id: String(puzzle.id ?? `puzzle-${index}`),
    kind: 'puzzle',
    title: String(puzzle.title ?? 'Puzzle'),
    text: String(puzzle.question ?? puzzle.title ?? 'Puzzle'),
    act: typeof puzzle.act === 'number' ? puzzle.act : undefined,
    image: typeof (puzzle as any).image === 'string' ? String((puzzle as any).image) : undefined,
  }))

  const reveals: EvidenceItem[] = input.reveals.map((card, index) => ({
    id: String(card.id ?? `reveal-${index}`),
    kind: 'reveal',
    title: 'Reveal',
    text: String(card.text ?? 'Reveal'),
    act: typeof card.act === 'number' ? card.act : undefined,
    image: typeof (card as any).image === 'string' ? String((card as any).image) : undefined,
  }))

  return [...clues, ...puzzles, ...reveals]
}

// (moved) storyHeroImage -> src/utils/storyHeroImage.ts
