import {
  createGame,
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
  createGame,
  fetchHostGame,
  postHostAction,
  postEndNight,
  joinPlayerByCharacter,
  submitObjective,
  postMove,
  fetchPlayerViewByCharacter,
}

