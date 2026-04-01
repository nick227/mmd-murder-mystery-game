import type { LayoutNode, ScreenData } from '../../data/types'

/** Resolves layout bind paths like `feed` or `objectives.personal`. */
export function getBoundValue(node: LayoutNode, data: ScreenData): unknown {
  if (!node.bind) return undefined
  const [top, sub] = node.bind.split('.')
  const topValue = data[top as keyof ScreenData]
  if (sub && topValue && typeof topValue === 'object') {
    return (topValue as Record<string, unknown>)[sub]
  }
  return topValue
}
