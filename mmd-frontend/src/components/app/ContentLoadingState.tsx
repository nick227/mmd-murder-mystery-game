import { useId } from 'react'

export interface ContentLoadingStateProps {
  /** Single-line override (e.g. tests); skips themed headline + detail. */
  label?: string
  className?: string
}

const THEMES = [
  {
    title: 'Setting the table…',
    detail: 'Your briefing and materials will follow shortly.',
  },
  {
    title: 'Straightening the place cards…',
    detail: 'Almost time to take your seat.',
  },
  {
    title: 'Lighting the dining room…',
    detail: 'The scene is being prepared for you.',
  },
] as const

function themeForLocation() {
  const key = `${window.location.pathname}${window.location.search}`
  let h = 0
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) | 0
  return THEMES[Math.abs(h) % THEMES.length]
}

/** Content-column loading (not full screen); use below sticky header. */
export function ContentLoadingState({ label, className }: ContentLoadingStateProps) {
  const labelId = useId()
  const theme = themeForLocation()

  return (
    <div
      className={`content-loading${className ? ` ${className}` : ''}`}
      role="status"
      aria-live="polite"
      aria-busy="true"
      aria-labelledby={labelId}
    >
      <div className="content-loading__mark" aria-hidden>
        <svg className="content-loading__envelope" viewBox="0 0 56 44" fill="none">
          <path
            className="content-loading__envelope-body"
            d="M4 12h48v24a4 4 0 01-4 4H8a4 4 0 01-4-4V12z"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinejoin="round"
          />
          <path
            className="content-loading__envelope-flap"
            d="M4 12l24 14L52 12"
            stroke="currentColor"
            strokeWidth="1.75"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>

      <div id={labelId} className="content-loading__text">
        {label ? (
          <p className="content-loading__title">{label}</p>
        ) : (
          <>
            <p className="content-loading__eyebrow">Murder Mystery Dinner</p>
            <p className="content-loading__title">{theme.title}</p>
            <p className="content-loading__detail">{theme.detail}</p>
          </>
        )}
      </div>
    </div>
  )
}
