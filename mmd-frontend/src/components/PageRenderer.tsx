import type { PageSchema, RendererHandlers, ScreenData, TabId } from '../data/types'
import { RenderNode } from './primitives'

interface Props {
  schema: PageSchema
  data: ScreenData
  activeTab?: TabId
  handlers?: RendererHandlers
}

export function PageRenderer({ schema, data, activeTab, handlers }: Props) {
  const key = activeTab ?? 'root'
  const nodes = schema.layouts[key] ?? []
  return (
    <main className="screen-stack">
      {nodes.map((node) => (
        <RenderNode key={node.id} node={node} data={data} handlers={handlers} />
      ))}
    </main>
  )
}
