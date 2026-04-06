import { FeedItem, HostApiGame, ScreenData } from '../data/types'
import { mapApiEventToProgressFeedItem } from '../data/screenData/playerScreenModel'
import { emptyScreenData } from '../data/mock'
import { storyHeroImage } from '../utils/storyHeroImage'

function buildShareQuery(params: { apiBase: string }) {
  const query = new URLSearchParams()
  if (params.apiBase) query.set('api', params.apiBase)
  return query
}

function buildPlayerPath(gameId: string, characterId: string, query: URLSearchParams) {
  const suffix = query.toString()
  return `${window.location.origin}/room/${gameId}/${characterId}${suffix ? `?${suffix}` : ''}`
}

function countdownParts(scheduledTime?: string) {
  if (!scheduledTime) return { label: undefined, percent: undefined }
  const target = new Date(scheduledTime).getTime()
  const diff = target - Date.now()
  if (diff <= 0) return { label: 'Start anytime', percent: 100 }
  const total = 2 * 60 * 60 * 1000
  const pct = ((total - Math.min(diff, total)) / total) * 100
  const minutes = Math.ceil(diff / (60 * 1000))
  return { label: `${minutes}m until start`, percent: Math.max(5, Math.min(100, pct)) }
}

export function buildHostScreen(game: HostApiGame, apiBase: string): ScreenData {
  const finalAct = game.maxAct ?? 3
  const countdown = countdownParts(game.scheduledTime)
  const shareQuery = buildShareQuery({ apiBase })
  const playerLinks = game.players.map(player => ({
    characterId: player.characterId,
    label: player.characterName ?? player.playerName ?? `Character ${player.characterId}`,
    url: buildPlayerPath(game.id, player.characterId, shareQuery),
    joined: Boolean(player.joinedAt),
  }))

  const feed: FeedItem[] = [
    {
      id: 'host-system',
      type: 'system',
      text: game.state === 'SCHEDULED'
        ? 'Lobby is open. The host can start early at any time.'
        : game.state === 'REVEAL'
        ? 'Reveal is in progress.'
        : game.state === 'DONE'
        ? 'Game over. Thanks for hosting.'
      : game.state === 'PLAYING' && game.currentAct >= finalAct
      ? `Final act (${game.currentAct}). Use Reveal Secrets to conclude.`
        : `Act ${game.currentAct} is active.`,
    },
  ]

  if (Array.isArray(game.feed) && game.feed.length) {
    feed.push(...game.feed.slice(-20).map(mapApiEventToProgressFeedItem).filter((it): it is FeedItem => Boolean(it)))
  }

  return {
    ...emptyScreenData,
    game: {
      state: game.state,
      act: game.currentAct,
      title:
        game.state === 'SCHEDULED'
          ? 'Host lobby'
          : game.state === 'REVEAL'
          ? 'Reveal in progress'
          : game.state === 'DONE'
          ? 'Game over'
          : `Act ${game.currentAct}`,
      subtitle: `${game.storyTitle ?? game.name} · Host control room`,

      hostName: game.creatorName ?? null,

      locationText: game.locationText ?? null,
      description: game.stageText
        ? String(game.stageText)
        : game.state === 'SCHEDULED'
        ? 'Share character links, watch who joins, and start whenever the room is ready.'
        : game.state === 'REVEAL'
        ? 'Answers are live. Finish the game when you are ready.'
        : game.state === 'DONE'
        ? 'The game has ended. No further host actions are available.'
        : game.state === 'PLAYING' && game.currentAct >= finalAct
        ? 'Final act reached. Use Reveal Secrets when discussion is finished.'
        : 'Everyone is in the game. Advance acts only when the room is ready.',
      image: storyHeroImage(game.stageImage),
      countdownLabel: game.state === 'SCHEDULED' ? countdown.label : undefined,
      countdownPercent: game.state === 'SCHEDULED' ? countdown.percent : undefined,
      banner: game.state === 'SCHEDULED'
        ? 'You are in the host control room.'
        : game.state === 'DONE'
        ? 'Game over.'
        : 'Host controls are live.',
    },
    players: game.players.map(player => ({
      id: player.id,
      name: player.characterName ?? player.playerName ?? `Character ${player.characterId}`,
      joinedName: typeof player.playerName === 'string' && player.playerName.trim().length > 0 ? player.playerName.trim() : undefined,
      characterId: player.characterId,
      online: Boolean(player.joinedAt),
      portrait: typeof player.portrait === 'string' ? player.portrait : undefined,
    })),
    feed,
    objectives: {
      personal: [],
      group: [],
      reveals: [],
      host: [
        { id: 'host-1', text: 'Watch joined status and wait until the room is ready.', completed: false },
        { id: 'host-2', text: 'Advance acts only when conversation energy drops.', completed: false },
        { id: 'host-3', text: 'Use End Night only after final discussion.', completed: false },
      ],
    },
    profile: {
      characterName: 'Host',
      archetype: 'Game master',
      biography: 'You control pacing, stage transitions, and the reveal.',
      secrets: [],
      items: [],
      cards: [],
    },
    composer: {
      mode: 'public',
      draft: '',
      placeholder: 'Host messaging is still frontend-only in this patch.',
      recipients: [],
      canSend: false,
    },
    gameActions:
      game.state === 'SCHEDULED'
        ? [
            { id: 'player-links', label: 'Player Links', kind: 'secondary' },
            { id: 'start', label: 'Start Game', kind: 'primary' }
          ]
        : game.state === 'PLAYING'
        ? [
            { id: 'player-links', label: 'Player Links', kind: 'secondary' },
            { id: 'next', label: `Next Act (${game.currentAct + 1})`, kind: 'primary', disabled: game.currentAct >= finalAct },
            { id: 'reveal', label: 'Reveal Secrets', kind: 'secondary', disabled: game.currentAct < finalAct },
          ]
        : game.state === 'REVEAL'
        ? [
            { id: 'player-links', label: 'Player Links', kind: 'secondary' },
          ]
        : [],
    hostInfo: {
      gameId: game.id,
      storyTitle: game.storyTitle ?? game.name,
      scheduledTime: game.scheduledTime,
      locationText: game.locationText,
      hostKey: game.hostKey,
      playerLinks,
    },
  }
}
