import { useEffect, useState } from 'react'
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

interface Props {
  onClose: () => void
  won: boolean
  city: string
  guessCount: number
  puzzleNumber: number
  stats: PlayerStats | null
  guesses: ShareGuess[]
}

const DIRECTION_EMOJI: Record<string, string> = {
  N: '⬆️', NE: '↗️', E: '➡️', SE: '↘️', S: '⬇️', SW: '↙️', W: '⬅️', NW: '↖️',
}

// Proximity bucket for one guess. Green is reserved for the correct answer;
// the rest are a hot/warm/cold read on distance. Thresholds are deliberately
// rough — easy to tune once we see real games.
function proximityEmoji(g: ShareGuess): string {
  if (g.correct) return '🟩'
  if (g.distanceKm <= 150) return '🟨'
  if (g.distanceKm <= 750) return '🟧'
  return '🟥'
}

function directionEmoji(g: ShareGuess): string {
  return g.correct ? '🎯' : DIRECTION_EMOJI[g.direction] ?? '⬛'
}

function buildShareText(
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

// Rendered only while open (parent gates the mount), so it always starts fresh.
export function WinModal({ onClose, won, city, guessCount, puzzleNumber, stats, guesses }: Props) {
  const [copied, setCopied] = useState(false)

  // Close on Escape.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  async function share() {
    const text = buildShareText(puzzleNumber, won, guesses, stats)
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(text)
        setCopied(true)
      }
    } catch {
      // User dismissed the share sheet, or clipboard denied — ignore.
    }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={won ? 'You won' : 'Out of guesses'} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label="Close">×</button>

        <div className="modal-emoji">{won ? '🎉' : '😔'}</div>
        <h2 className="modal-title">{won ? 'Solved it!' : 'Out of guesses'}</h2>
        <p className="modal-sub">
          {won ? (
            <>
              Today's city was <strong>{city}</strong> — you got it in{' '}
              <strong>{guessCount}</strong> guess{guessCount === 1 ? '' : 'es'}.
            </>
          ) : (
            <>
              The city was <strong>{city}</strong>. Better luck tomorrow!
            </>
          )}
        </p>

        {stats && (
          <>
            <div className="stat-row">
              <Stat label="Played" value={stats.gamesPlayed} />
              <Stat label="Won" value={stats.wins} />
              <Stat label="Win %" value={stats.winPct} />
              <Stat label="Streak" value={stats.currentStreak} />
              <Stat label="Max streak" value={stats.maxStreak} />
              <Stat label="Avg. guesses" value={stats.avgGuesses || '—'} />
            </div>
            <p className="stat-footer">
              {stats.lastWin && <>Last win: {stats.lastWin} · </>}
              Today: {guessCount} guess{guessCount === 1 ? '' : 'es'}
            </p>
          </>
        )}

        <button className="share-btn" onClick={share}>
          {copied ? 'Copied!' : 'Share'}
        </button>
      </div>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  )
}
