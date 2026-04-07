import { useEffect, useMemo, useState } from 'react'
import type { MediaProps } from '../../data/types'

function ratioStyle(ratio: MediaProps['ratio']): { aspectRatio?: string } {
  if (ratio === '16:9') return { aspectRatio: '16 / 9' }
  if (ratio === '4:3') return { aspectRatio: '4 / 3' }
  if (ratio === '1:1') return { aspectRatio: '1 / 1' }
  return {}
}

function normalizeSrc(raw: string | undefined): string | undefined {
  if (!raw) return undefined
  const trimmed = raw.trim()
  if (!trimmed) return undefined

  // Avoid mangling opaque URLs.
  if (/^(data|blob):/i.test(trimmed)) return trimmed

  try {
    return encodeURI(trimmed)
  } catch {
    return trimmed
  }
}

export function Media({
  kind = 'image',
  src,
  poster,
  alt = '',
  ratio = 'auto',
  variant = 'card',
  fit,
  priority = false,
  sizes,
  role = 'content',
  onClick,
  fallback = { type: 'gradient' },
}: MediaProps) {
  const [failed, setFailed] = useState(false)
  const [loaded, setLoaded] = useState(false)

  const effectiveFit: NonNullable<MediaProps['fit']> =
    fit ?? (variant === 'hero' ? 'cover' : variant === 'thumb' ? 'cover' : 'contain')

  const effectiveSrc = kind === 'image' ? normalizeSrc(src) : normalizeSrc(poster)
  const showFallback = failed || !effectiveSrc
  const wrapperStyle = useMemo(() => ratioStyle(ratio), [ratio])
  const zoomable = role === 'decorative' || role === 'content'

  const imgAlt = role === 'decorative' ? '' : alt
  const ariaHidden = role === 'decorative' ? true : undefined

  useEffect(() => {
    setFailed(false)
    setLoaded(false)
  }, [effectiveSrc])

  const fallbackLabel =
    typeof fallback.label === 'string' && fallback.label.trim().length > 0
      ? fallback.label.trim()
      : fallback.type === 'icon'
      ? 'Media'
      : fallback.type === 'initials'
      ? '?'
      : ''

  return (
    <div
      className={[
        'media',
        `media--${variant}`,
        `media--kind-${kind}`,
        `media--ratio-${ratio}`,
        loaded ? 'media--loaded' : 'media--loading',
        onClick ? 'is-clickable' : '',
        zoomable ? 'media--zoomable' : '',
      ].filter(Boolean).join(' ')}
      style={wrapperStyle}
      data-fallback={fallback.type}
      data-fit={effectiveFit}
      data-role={role}
      role={onClick ? 'group' : undefined}
      tabIndex={onClick ? -1 : undefined}
      onClick={onClick}
    >
      {showFallback ? (
        <div className="media__fallback" aria-label={alt || 'Media'} aria-hidden={ariaHidden}>
          {fallback.type === 'icon' ? <span className="media__icon">▣</span> : null}
          {fallbackLabel ? <span className="media__label">{fallbackLabel}</span> : null}
        </div>
      ) : (
        <>
          <div className="media__placeholder" aria-hidden="true">
            <div className="media__placeholderInner" />
          </div>
          <img
            className="media__img"
            src={effectiveSrc}
            alt={imgAlt}
            loading={priority ? 'eager' : 'lazy'}
            decoding="async"
            sizes={sizes}
            aria-hidden={ariaHidden}
            onLoad={() => setLoaded(true)}
            onError={() => setFailed(true)}
          />
        </>
      )}
    </div>
  )
}
