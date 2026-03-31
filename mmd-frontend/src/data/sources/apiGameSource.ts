import {
  cancelGame,
  createGame,
  fetchGames,
  fetchHostGame,
  fetchPlayerViewByCharacter,
  fetchStories,
  joinPlayerByCharacter,
  postEndNight,
  postHostAction,
  postMove,
  rescheduleGame,
  submitObjective,
} from '../api'
import type { GameSource } from './types'

export const apiGameSource: GameSource = {
  fetchStories,
  fetchGames,
  createGame,
  fetchHostGame,
  cancelGame,
  rescheduleGame,
  postHostAction,
  postEndNight,
  joinPlayerByCharacter,
  submitObjective,
  postMove,
  fetchPlayerViewByCharacter,
}

