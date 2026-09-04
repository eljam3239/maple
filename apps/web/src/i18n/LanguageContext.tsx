import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import { dicts, DEFAULT_LANG, type Dict, type Lang } from './translations'

interface LanguageCtx {
  lang: Lang
  setLang: (l: Lang) => void
  t: Dict // resolved dictionary for the active language
}

const Ctx = createContext<LanguageCtx | null>(null)

const STORAGE_KEY = 'maple-lang'

// Prior choice wins; otherwise fall to the browser's language if it's French,
// else English. localStorage may throw in locked-down/privacy browsers, so the
// read is guarded — identity/streak storage has the same fragility (see
// getOrCreatePlayerId), and language just defaults cleanly if it's unavailable.
function initialLang(): Lang {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored && stored in dicts) return stored as Lang
  } catch {
    // ignore — fall through to detection
  }
  if (typeof navigator !== 'undefined' && navigator.language?.toLowerCase().startsWith('fr')) {
    return 'fr'
  }
  return DEFAULT_LANG
}

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLang] = useState<Lang>(initialLang)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, lang)
    } catch {
      // ignore — selection just won't persist across reloads
    }
    document.documentElement.lang = lang
  }, [lang])

  return (
    <Ctx.Provider value={{ lang, setLang, t: dicts[lang] }}>
      {children}
    </Ctx.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components -- hook colocated with its provider by design
export function useLang(): LanguageCtx {
  const ctx = useContext(Ctx)
  if (!ctx) throw new Error('useLang must be used within a LanguageProvider')
  return ctx
}
