interface Props {
  title: string
  meta?: string
}

export function PanelHeader({ title, meta }: Props) {
  return (
    <div className="panel__header">
      <h2>{title}</h2>
      {meta ? <div className="panel__meta">{meta}</div> : null}
    </div>
  )
}

