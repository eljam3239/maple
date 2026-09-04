import type { ReactNode } from 'react'

// Supported UI languages. English and French are fully translated; the three
// Indigenous languages are wired up and selectable but fall back to English
// until a native speaker supplies real strings (see `cr` / `iu` / `oj` below).
export type Lang = 'en' | 'fr' | 'cr' | 'iu' | 'oj'

export const DEFAULT_LANG: Lang = 'en'

// Every user-facing string in the app. Values that need a count or an
// interpolated name (or embedded <strong>) are functions; everything else is a
// plain string. Each language must implement this shape — except the Indigenous
// languages, which provide a Partial merged over English (see `dicts`).
export interface Dict {
  appTitle: string
  loading: string

  // Map province-distance legend
  legendTitle: string
  legendSame: string
  legend1: string
  legend2: string
  legend3plus: string

  // Post-game banner shown above the board
  solvedBanner: (guessCount: number) => string
  outOfGuessesBanner: string

  guessesLeft: (left: number, max: number) => string

  // Errors
  errFailedSession: string
  errGeneric: string
  errNetwork: string

  // Guess table
  thNum: string
  thCity: string
  thProvince: string
  thDistance: string
  thDirection: string
  thPopulation: string
  popLarger: string
  popSmaller: string
  guessesEmpty: string

  // Map controls
  mapBack: string
  mapHint: string

  // Autocomplete
  acPlaceholder: string
  guessBtn: string
  guessedTag: string

  // Win / loss modal
  ariaWon: string
  ariaLost: string
  close: string
  modalTitleWon: string
  modalTitleLost: string
  modalSubWon: (city: string, guessCount: number) => ReactNode
  modalSubLost: (city: string) => ReactNode
  statPlayed: string
  statWon: string
  statWinPct: string
  statStreak: string
  statMaxStreak: string
  statAvgGuesses: string
  lastWin: (date: string) => string
  todayGuesses: (guessCount: number) => string
  share: string
  copied: string

  languageLabel: string
}

const en: Dict = {
  appTitle: 'Maple',
  loading: 'Loading...',

  legendTitle: 'Province distance',
  legendSame: 'Same province',
  legend1: '1 province away',
  legend2: '2 provinces away',
  legend3plus: '3+ provinces away',

  solvedBanner: (n) => `Solved in ${n} guess${n === 1 ? '' : 'es'} — view results`,
  outOfGuessesBanner: '😔 Out of guesses — view results',

  guessesLeft: (left, max) => `${left} of ${max} guess${left === 1 ? '' : 'es'} left`,

  errFailedSession: 'Failed to start session',
  errGeneric: 'Something went wrong',
  errNetwork: 'Network error',

  thNum: '#',
  thCity: 'City',
  thProvince: 'Province',
  thDistance: 'Distance',
  thDirection: 'Direction',
  thPopulation: 'Population',
  popLarger: '⬆️ larger',
  popSmaller: '⬇️ smaller',
  guessesEmpty: 'Your guesses will appear here.',

  mapBack: '← Canada',
  mapHint: 'Double-click or scroll to zoom · drag to pan',

  acPlaceholder: 'Guess a Canadian city...',
  guessBtn: 'Guess',
  guessedTag: 'guessed',

  ariaWon: 'You won',
  ariaLost: 'Out of guesses',
  close: 'Close',
  modalTitleWon: 'Solved it!',
  modalTitleLost: 'Out of guesses',
  modalSubWon: (city, n) => (
    <>
      Today's city was <strong>{city}</strong> — you got it in{' '}
      <strong>{n}</strong> guess{n === 1 ? '' : 'es'}.
    </>
  ),
  modalSubLost: (city) => (
    <>
      The city was <strong>{city}</strong>. Better luck tomorrow!
    </>
  ),
  statPlayed: 'Played',
  statWon: 'Won',
  statWinPct: 'Win %',
  statStreak: 'Streak',
  statMaxStreak: 'Max streak',
  statAvgGuesses: 'Avg. guesses',
  lastWin: (d) => `Last win: ${d}`,
  todayGuesses: (n) => `Today: ${n} guess${n === 1 ? '' : 'es'}`,
  share: 'Share',
  copied: 'Copied!',

  languageLabel: 'Language',
}

const fr: Dict = {
  appTitle: 'Maple',
  loading: 'Chargement...',

  legendTitle: 'Distance des provinces',
  legendSame: 'Même province',
  legend1: 'À 1 province',
  legend2: 'À 2 provinces',
  legend3plus: 'À 3 provinces ou plus',

  solvedBanner: (n) => `Résolu en ${n} essai${n === 1 ? '' : 's'} — voir les résultats`,
  outOfGuessesBanner: '😔 Plus d’essais — voir les résultats',

  guessesLeft: (left, max) => `${left} essai${left === 1 ? '' : 's'} sur ${max} restant${left === 1 ? '' : 's'}`,

  errFailedSession: 'Échec du démarrage de la session',
  errGeneric: 'Une erreur s’est produite',
  errNetwork: 'Erreur réseau',

  thNum: '#',
  thCity: 'Ville',
  thProvince: 'Province',
  thDistance: 'Distance',
  thDirection: 'Direction',
  thPopulation: 'Population',
  popLarger: '⬆️ plus grande',
  popSmaller: '⬇️ plus petite',
  guessesEmpty: 'Vos essais apparaîtront ici.',

  mapBack: '← Canada',
  mapHint: 'Double-cliquez ou défilez pour zoomer · glissez pour déplacer',

  acPlaceholder: 'Devinez une ville canadienne...',
  guessBtn: 'Deviner',
  guessedTag: 'deviné',

  ariaWon: 'Vous avez gagné',
  ariaLost: 'Plus d’essais',
  close: 'Fermer',
  modalTitleWon: 'Résolu !',
  modalTitleLost: 'Plus d’essais',
  modalSubWon: (city, n) => (
    <>
      La ville d'aujourd'hui était <strong>{city}</strong> — vous l'avez trouvée en{' '}
      <strong>{n}</strong> essai{n === 1 ? '' : 's'}.
    </>
  ),
  modalSubLost: (city) => (
    <>
      La ville était <strong>{city}</strong>. Meilleure chance demain !
    </>
  ),
  statPlayed: 'Parties',
  statWon: 'Gagnées',
  statWinPct: '% victoires',
  statStreak: 'Série',
  statMaxStreak: 'Série max',
  statAvgGuesses: 'Essais moy.',
  lastWin: (d) => `Dernière victoire : ${d}`,
  todayGuesses: (n) => `Aujourd'hui : ${n} essai${n === 1 ? '' : 's'}`,
  share: 'Partager',
  copied: 'Copié !',

  languageLabel: 'Langue',
}

// ---------------------------------------------------------------------------
// Indigenous languages — scaffolded, NOT yet translated.
//
// These are intentionally empty. Each is spread over `en` in `dicts` below, so
// any key left out here transparently falls back to the English string. That
// keeps the language selectable and the app fully functional while we source
// accurate translations from native speakers.
//
// Do NOT fill these with machine translation — Plains Cree (syllabics),
// Inuktitut (syllabics), and Ojibwe (double-vowel roman / syllabics) need a
// fluent translator, and the right dialect matters. Add keys incrementally as
// verified strings come in; partial coverage is fine.
// ---------------------------------------------------------------------------

/** Nēhiyawēwin (Plains Cree) — TODO: native translation. */
const cr: Partial<Dict> = {}

/** ᐃᓄᒃᑎᑐᑦ (Inuktitut) — TODO: native translation. */
const iu: Partial<Dict> = {}

/** Anishinaabemowin (Ojibwe) — TODO: native translation. */
const oj: Partial<Dict> = {}

export const dicts: Record<Lang, Dict> = {
  en,
  fr,
  cr: { ...en, ...cr },
  iu: { ...en, ...iu },
  oj: { ...en, ...oj },
}

// Display order and labels for the picker. Labels are each language's own
// autonym with the English name in parentheses for recognition.
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
  { code: 'cr', label: 'Nēhiyawēwin (Cree)' },
  { code: 'iu', label: 'ᐃᓄᒃᑎᑐᑦ (Inuktitut)' },
  { code: 'oj', label: 'Anishinaabemowin (Ojibwe)' },
]
