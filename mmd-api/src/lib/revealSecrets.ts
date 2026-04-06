import { prisma } from './prisma.js'
import { publishRoomEvent } from './roomEvents.js'

interface GameState {
  id: string
  currentAct: number
}

interface RevealOptions {
  game: GameState
  state: { state: string; currentAct: number }
  storyFile: string | null
  delayMs?: number
}

export async function revealSolutionsSequentially({
  game,
  state,
  storyFile,
  delayMs = 800,
}: RevealOptions): Promise<void> {
  const { readSolutionAnnouncements } = await import('./solutionReader.js')
  const solutions = await readSolutionAnnouncements(storyFile)
  const isFirst = (i: number) => i === 0
  const isLast = (i: number, arr: unknown[]) => i === arr.length - 1

  for (let i = 0; i < solutions.length; i++) {
    const basePayload = solutions[i]
    const payload = {
      ...basePayload,
      message: basePayload.message,
      autoScroll: true,
      final: isLast(i, solutions),
    }

    const event = await prisma.gameEvent.create({
      data: {
        gameId: game.id,
        playerId: null,
        type: 'ANNOUNCEMENT',
        payload: payload as any,
      },
    })

    publishRoomEvent({
      gameId: game.id,
      eventId: event.id,
      eventType: String(event.type),
      gameState: state.state,
      currentAct: state.currentAct,
    })

    await new Promise(resolve => setTimeout(resolve, delayMs))
  }
}
