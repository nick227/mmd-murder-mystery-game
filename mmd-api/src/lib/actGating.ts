/**
 * Act-gating: the core unlock mechanic.
 *
 * Each puzzle, card, and mystery in the story JSON can have an optional `act`
 * field. Content is visible when game.currentAct >= item.act.
 *
 * If no `act` is set on the item, it defaults to 1 (visible from the start).
 */

interface ActGated {
  act?: number
  [key: string]: unknown
}

/**
 * Filters an array of story items to only those unlocked at the given act.
 */
export function filterByAct<T extends ActGated>(items: T[], currentAct: number): T[] {
  if (currentAct === 0) return [] // game hasn't started
  return items.filter(item => (item.act ?? 1) <= currentAct)
}

/**
 * Gets the character object from story dataJson by characterId.
 */
export function getCharacter(storyData: any, characterId: string): any | null {
  const characters: any[] = storyData?.characters ?? []
  return characters.find(c => c.id === characterId) ?? null
}

/**
 * Strips solution answers from mystery objects for player view.
 * Players see questions, never answers (until REVEAL state).
 */
export function stripMysteryAnswers(mysteries: any[]): any[] {
  return mysteries.map(({ answer: _answer, notes: _notes, ...rest }) => rest)
}

/**
 * Strips puzzle answers for player view.
 */
export function stripPuzzleAnswers(puzzles: any[]): any[] {
  return puzzles.map(({ answer: _answer, ...rest }) => rest)
}
