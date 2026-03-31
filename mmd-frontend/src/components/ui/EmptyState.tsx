interface Props {
  text: string
}

export function EmptyState({ text }: Props) {
  return <div className="empty-state">{text}</div>
}

