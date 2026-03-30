import {
  createGame,
  fetchHostGame,
  fetchPlayerViewByCharacter,
  fetchStories,
  joinPlayerByCharacter,
  postEndNight,
  postHostAction,
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
  fetchPlayerViewByCharacter,
}

