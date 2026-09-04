import type { ReactNode } from 'react'

// Supported UI languages. Canada's two official languages, both fully
// translated. Adding one means adding its `Dict` and a `LANGUAGES` entry.
export type Lang = 'en' | 'fr'

export const DEFAULT_LANG: Lang = 'en'

// Every user-facing string in the app. Values that need a count or an
// interpolated name (or embedded <strong>) are functions; everything else is a
// plain string. Every language must implement this shape in full.
export interface Dict {
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

  // Native-Land.ca territory link, shown with the revealed answer
  landTitle: string
  landLink: (city: string) => string
  landNote: string

  // How-to-play popover
  howToLabel: string
  howToTitle: string
  howToSteps: (max: number) => ReactNode[]

  githubLabel: string
  languageLabel: string
}

const en: Dict = {
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
  popLarger: 'larger',
  popSmaller: 'smaller',
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

  landTitle: 'Whose land?',
  landLink: (city) => `See the territories around ${city} →`,
  landNote: 'Map by Native Land Digital — a work in progress, not a definitive or legal source.',

  howToLabel: 'How to play',
  howToTitle: 'How to play',
  howToSteps: (max) => [
    <>Guess the mystery Canadian city in <strong>{max}</strong> tries.</>,
    <>Every guess must be a real Canadian city — start typing and pick one from the list.</>,
    <>After each guess you'll see the <strong>distance</strong> and <strong>direction</strong> to the target, and whether its population is larger or smaller.</>,
    <>The map shades each province by how far it is from the answer's province.</>,
    <>A new city every day. Come back tomorrow!</>,
  ],

  githubLabel: 'Source on GitHub',
  languageLabel: 'Language',
}

const fr: Dict = {
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
  popLarger: 'plus grande',
  popSmaller: 'plus petite',
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

  landTitle: 'À qui appartient cette terre ?',
  landLink: (city) => `Voir les territoires autour de ${city} →`,
  landNote: 'Carte de Native Land Digital — un travail en cours, ni définitif ni juridique.',

  howToLabel: 'Comment jouer',
  howToTitle: 'Comment jouer',
  howToSteps: (max) => [
    <>Devinez la ville canadienne mystère en <strong>{max}</strong> essais.</>,
    <>Chaque essai doit être une vraie ville canadienne — commencez à taper et choisissez dans la liste.</>,
    <>Après chaque essai, vous verrez la <strong>distance</strong> et la <strong>direction</strong> vers la cible, et si sa population est plus grande ou plus petite.</>,
    <>La carte colore chaque province selon sa distance de la province de la réponse.</>,
    <>Une nouvelle ville chaque jour. Revenez demain !</>,
  ],

  githubLabel: 'Code source sur GitHub',
  languageLabel: 'Langue',
}

export const dicts: Record<Lang, Dict> = { en, fr }

// Display order and labels for the picker. Labels are each language's own
// autonym.
export const LANGUAGES: { code: Lang; label: string }[] = [
  { code: 'en', label: 'English' },
  { code: 'fr', label: 'Français' },
]
