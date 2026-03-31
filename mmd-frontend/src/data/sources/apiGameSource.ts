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
  submitObjective,
} from '../api'
import type { GameSource } from './types'

export const apiGameSource: GameSource = {
  fetchStories,
  fetchGames,
  createGame,
  fetchHostGame,
  cancelGame,
  postHostAction,
  postEndNight,
  joinPlayerByCharacter,
  submitObjective,
  postMove,
  fetchPlayerViewByCharacter,
}

