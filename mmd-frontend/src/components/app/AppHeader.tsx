export interface AppHeaderProps {
  eyebrow: string
  title: string
  statusLabel: string
}

export function AppHeader(props: AppHeaderProps) {
  const { eyebrow, title, statusLabel } = props

  return (
    <header className="app-header">
        <div className="app-header__eyebrow">{eyebrow}</div>
        <div>{statusLabel}</div>
      <div>
        <h1>{title}</h1>
      </div>
    </header>
  )
}
