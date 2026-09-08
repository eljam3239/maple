import { useEffect, useState } from 'react'
import { MapleLeaf } from './MapleLeaf'
import { useLang } from './i18n/LanguageContext'
import {
  buildShareText,
  copyToClipboard,
  nativeLandUrl,
  type AnswerPlace,
  type PlayerStats,
  type ShareGuess,
} from './share'

export type { AnswerPlace, PlayerStats, ShareGuess }

interface Props {
  onClose: () => void
  won: boolean
  city: string
  place: AnswerPlace | null
  guessCount: number
  puzzleNumber: number
  stats: PlayerStats | null
  guesses: ShareGuess[]
}

// Rendered only while open (parent gates the mount), so it always starts fresh.
export function WinModal({ onClose, won, city, place, guessCount, puzzleNumber, stats, guesses }: Props) {
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

        {place && (
          <div className="land-block">
            <div className="land-title">{t.landTitle}</div>
            <a
              className="land-link"
              href={nativeLandUrl(place)}
              target="_blank"
              rel="noopener noreferrer"
            >
              {t.landLink(place.name)}
            </a>
            <p className="land-note">{t.landNote}</p>
          </div>
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
