import { useLang } from './i18n/LanguageContext'
import { LANGUAGES, type Lang } from './i18n/translations'

// Language selector, rendered in the header. A plain <select> for native
// keyboard/screen-reader support; the active choice is persisted by the context.
export function LanguagePicker() {
  const { lang, setLang, t } = useLang()
  return (
    <select
      className="lang-picker"
      value={lang}
      onChange={(e) => setLang(e.target.value as Lang)}
      aria-label={t.languageLabel}
    >
      {LANGUAGES.map((l) => (
        <option key={l.code} value={l.code}>
          {l.label}
        </option>
      ))}
    </select>
  )
}
