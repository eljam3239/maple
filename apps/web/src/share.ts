import { MAX_GUESSES } from '@maple/types'

export interface PlayerStats {
  currentStreak: number
  maxStreak: number
  gamesPlayed: number
  wins: number
  winPct: number
  avgGuesses: number
  lastWin: string | null
}

// A guess as far as the share grid cares.
export interface ShareGuess {
  correct: boolean
  distanceKm: number
  direction: string
}

// The revealed target, used to deep-link into Native-Land.ca. Null until the
// answer is known (i.e. before the game ends).
export interface AnswerPlace {
  name: string
  province: string
  latitude: number
  longitude: number
}

// Deep link into Native Land Digital's map, centred on the answer. Their URL
// takes `center` as lon,lat (not lat,lon) plus a display `placename`; sending
// people to the source rather than restating its data here keeps the territory
// information theirs to correct and keep current.
export function nativeLandUrl(p: AnswerPlace): string {
  // Commas are decoded back to literal ones: native-land.ca's own share URLs
  // leave them raw (`Kitchener,%20Ontario,%20Canada`), and a comma is a legal
  // query character, so this matches their format exactly.
  const placename = encodeURIComponent(`${p.name}, ${p.province}, Canada`).replace(/%2C/g, ',')
  return `https://native-land.ca/place?center=${p.longitude},${p.latitude}&placename=${placename}`
}

const DIRECTION_EMOJI: Record<string, string> = {
  N: '⬆️', NE: '↗️', E: '➡️', SE: '↘️', S: '⬇️', SW: '↙️', W: '⬅️', NW: '↖️',
}

// Proximity bucket for one guess. Green is reserved for the correct answer;
// the rest are a hot/warm/cold read on distance. Thresholds are deliberately
// rough — easy to tune once we see real games.
export function proximityEmoji(g: ShareGuess): string {
  if (g.correct) return '🟩'
  if (g.distanceKm <= 150) return '🟨'
  if (g.distanceKm <= 750) return '🟧'
  return '🟥'
}

export function directionEmoji(g: ShareGuess): string {
  return g.correct ? '🎯' : DIRECTION_EMOJI[g.direction] ?? '⬛'
}

export function buildShareText(
  puzzleNumber: number,
  won: boolean,
  guesses: ShareGuess[],
  stats: PlayerStats | null,
): string {
  const score = won ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`
  const grid = guesses.map(g => proximityEmoji(g) + directionEmoji(g)).join('\n')
  const lines = [`Maple #${puzzleNumber} 🍁 ${score}`]
  if (stats) lines.push(`🔥 ${stats.currentStreak} | Avg. Guesses: ${stats.avgGuesses}`)
  lines.push(grid, '#maple')
  return lines.join('\n')
}

// Copy to clipboard so the result can be pasted (e.g. into Discord). Prefers
// the async Clipboard API; falls back to a hidden textarea + execCommand for
// insecure contexts (plain http) where the Clipboard API is unavailable.
export async function copyToClipboard(text: string): Promise<boolean> {
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text)
      return true
    }
  } catch {
    // fall through to the legacy path
  }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch {
    return false
  }
}
