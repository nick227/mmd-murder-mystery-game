import {
  cancelGame,
  createGame,
  fetchGames,
  fetchHostGame,
  fetchPublicGame,
  fetchPlayerViewByCharacter,
  fetchStories,
  joinPlayerByCharacter,
  postEndNight,
  postHostAction,
  postMove,
  rescheduleGame,
  updateScheduledGame,
  submitObjective,
} from '../api'
import type { GameSource } from './types'

export const apiGameSource: GameSource = {
  fetchStories,
  fetchGames,
  fetchPublicGame,
  createGame,
  fetchHostGame,
  cancelGame,
  rescheduleGame,
  updateScheduledGame,
  postHostAction,
  postEndNight,
  joinPlayerByCharacter,
  submitObjective,
  postMove,
  fetchPlayerViewByCharacter,
}

