import { initialsFromName } from './uiText'

function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n))
}

function hashToHue(input: string): number {
  let h = 0
  for (let i = 0; i < input.length; i++) h = (h * 31 + input.charCodeAt(i)) >>> 0
  return h % 360
}

/**
 * Deterministic SVG "portrait" (data URL) used when story assets are missing.
 * This is user-facing identity chrome, not authoritative game state.
 */
export function portraitDataUrl(name: string): string {
  const initials = initialsFromName(name)
  const hue = hashToHue(name || 'player')
  const hue2 = (hue + 42) % 360
  const a = clamp(0.22, 0.14, 0.30)
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="256" height="256" viewBox="0 0 256 256">` +
    `<defs>` +
    `<linearGradient id="g" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0%" stop-color="hsl(${hue}, 90%, 65%)" stop-opacity="${a}"/>` +
    `<stop offset="100%" stop-color="hsl(${hue2}, 90%, 60%)" stop-opacity="${a}"/>` +
    `</linearGradient>` +
    `</defs>` +
    `<rect width="256" height="256" rx="56" fill="url(#g)"/>` +
    `<circle cx="196" cy="66" r="46" fill="hsl(${hue2}, 90%, 62%)" fill-opacity="0.10"/>` +
    `<text x="50%" y="54%" text-anchor="middle" dominant-baseline="middle" ` +
      `font-family="Inter, ui-sans-serif, system-ui, -apple-system, Segoe UI, sans-serif" ` +
      `font-size="92" font-weight="800" letter-spacing="4" fill="rgba(238,242,255,.92)">${initials}</text>` +
    `</svg>`
  return `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`
}

