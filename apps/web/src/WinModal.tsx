import { useEffect, useState } from 'react'
import { MAX_GUESSES } from '@maple/types'
import { MapleLeaf } from './MapleLeaf'
import { useLang } from './i18n/LanguageContext'

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

// Copy to clipboard so the result can be pasted (e.g. into Discord). Prefers
// the async Clipboard API; falls back to a hidden textarea + execCommand for
// insecure contexts (plain http) where the Clipboard API is unavailable.
async function copyToClipboard(text: string): Promise<boolean> {
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
  const { t } = useLang()
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
    if (await copyToClipboard(text)) setCopied(true)
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" role="dialog" aria-modal="true" aria-label={won ? t.ariaWon : t.ariaLost} onClick={e => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose} aria-label={t.close}>×</button>

        <div className="modal-emoji">{won ? <MapleLeaf size={48} /> : '😔'}</div>
        <h2 className="modal-title">{won ? t.modalTitleWon : t.modalTitleLost}</h2>
        <p className="modal-sub">
          {won ? t.modalSubWon(city, guessCount) : t.modalSubLost(city)}
        </p>

        {stats && (
          <>
            <div className="stat-row">
              <Stat label={t.statPlayed} value={stats.gamesPlayed} />
              <Stat label={t.statWon} value={stats.wins} />
              <Stat label={t.statWinPct} value={stats.winPct} />
              <Stat label={t.statStreak} value={stats.currentStreak} />
              <Stat label={t.statMaxStreak} value={stats.maxStreak} />
              <Stat label={t.statAvgGuesses} value={stats.avgGuesses || '—'} />
            </div>
            <p className="stat-footer">
              {stats.lastWin && <>{t.lastWin(stats.lastWin)} · </>}
              {t.todayGuesses(guessCount)}
            </p>
          </>
        )}

        <button className="share-btn" onClick={share}>
          {copied ? t.copied : t.share}
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
