import { useEffect, useRef, useState } from 'react'
import { MAX_GUESSES } from '@maple/types'
import { useLang } from './i18n/LanguageContext'

// "?" button in the header that toggles a small how-to-play popover. Kept as a
// lightweight popover rather than a modal so it never fights the win/loss
// dialog for the screen; closes on Escape or on a click outside.
export function HowTo() {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const wrapRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function onPointerDown(e: PointerEvent) {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  return (
    <div className="howto" ref={wrapRef}>
      <button
        type="button"
        className="howto-btn"
        onClick={() => setOpen((o) => !o)}
        aria-label={t.howToLabel}
        aria-expanded={open}
        aria-haspopup="dialog"
      >
        ?
      </button>

      {open && (
        <div className="howto-panel" role="dialog" aria-label={t.howToTitle}>
          <h2 className="howto-title">{t.howToTitle}</h2>
          <ol className="howto-list">
            {t.howToSteps(MAX_GUESSES).map((step, i) => (
              <li key={i}>{step}</li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}
