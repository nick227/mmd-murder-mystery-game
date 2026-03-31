import type { PropsWithChildren } from 'react'

interface Props {
  open: boolean
  onClose: () => void
  eyebrow?: string
  title: string
  meta?: string
}

export function BottomSheet({ open, onClose, eyebrow, title, meta, children }: PropsWithChildren<Props>) {
  if (!open) return null

  return (
    <div className="focus-sheet" data-testid="bottom-sheet">
      <button type="button" className="focus-sheet__backdrop" aria-label="Close" onClick={onClose} />
      <section className="focus-sheet__panel" role="dialog" aria-modal="true">
        <div className="focus-sheet__header">
          <div>
            {eyebrow ? <div className="focus-sheet__eyebrow">{eyebrow}</div> : null}
            <div className="focus-sheet__title">{title}</div>
          </div>
          <button type="button" className="mini-btn" onClick={onClose}>Close</button>
        </div>
        {meta ? <div className="focus-sheet__meta">{meta}</div> : null}
        <div className="focus-sheet__body">{children}</div>
      </section>
    </div>
  )
}

