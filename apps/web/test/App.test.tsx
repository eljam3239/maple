import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MAX_GUESSES } from '@maple/types'
import { dicts } from '../src/i18n/translations'

// The map is a separate concern with its own SVG/layout needs; these tests are
// about the game loop, so it renders as inert wrappers.
vi.mock('react-simple-maps', () => ({
  ComposableMap: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  ZoomableGroup: ({ children }: { children?: React.ReactNode }) => <div>{children}</div>,
  Geographies: () => null,
  Geography: () => null,
  Marker: () => null,
  useZoomPanContext: () => ({ k: 1 }),
}))

const App = (await import('../src/App')).default
const { LanguageProvider } = await import('../src/i18n/LanguageContext')

const t = dicts.en

const CITIES = [
  { id: 1, name: 'Toronto', province: 'Ontario', aliases: [] },
  { id: 2, name: 'Montréal', province: 'Quebec', aliases: ['Montreal'] },
]

const SESSION = { sessionId: 's1', puzzleDate: '2026-03-10T00:00:00.000Z', completed: false, won: false, guesses: [], stats: null }

const MISS = {
  correct: false, city: 'Montréal', distanceKm: 504, direction: 'W',
  provinceMatch: false, province: 'Quebec', provinceDistance: 1,
  populationHint: 'larger', latitude: 45.5, longitude: -73.5,
  gameOver: false, won: false, guessesRemaining: MAX_GUESSES - 1,
}

const HIT = {
  correct: true, city: 'Toronto', distanceKm: 0, direction: 'N',
  provinceMatch: true, province: 'Ontario', provinceDistance: 0,
  populationHint: 'equal', latitude: 43.7, longitude: -79.4,
  gameOver: true, won: true, guessesRemaining: MAX_GUESSES - 2,
  answer: { name: 'Toronto', province: 'Ontario', latitude: 43.7, longitude: -79.4 },
  stats: { currentStreak: 1, maxStreak: 1, gamesPlayed: 1, wins: 1, winPct: 100, avgGuesses: 2, lastWin: '2026-03-10' },
}

/** Route each URL the app fetches to a canned response. */
function mockApi(routes: Record<string, unknown | (() => unknown)> = {}) {
  const guessQueue: unknown[] = []
  const fetchMock = vi.fn<typeof fetch>(async (input) => {
    const url = String(input)
    const key = Object.keys(routes).find(k => url.includes(k))
    let body: unknown

    if (key) {
      const route = routes[key]
      body = typeof route === 'function' ? (route as () => unknown)() : route
    } else if (url.includes('/api/cities')) body = CITIES
    else if (url.includes('/api/player')) body = { playerId: 'p1' }
    else if (url.includes('/api/session')) body = SESSION
    else if (url.includes('/api/guess')) body = guessQueue.shift() ?? MISS
    else if (url.includes('.geojson')) body = { type: 'FeatureCollection', features: [] }
    else throw new Error(`unmocked fetch: ${url}`)

    if (body && typeof body === 'object' && 'status' in (body as object)) {
      const { status, payload } = body as { status: number; payload: unknown }
      return { ok: status < 400, status, json: async () => payload } as Response
    }
    return { ok: true, status: 200, json: async () => body } as Response
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

const renderApp = () => {
  render(
    <LanguageProvider>
      <App />
    </LanguageProvider>,
  )
  return userEvent.setup()
}

/** Wait past the loading screen, and hand back the guess input. The language
 *  picker is also a combobox, so the placeholder is what tells them apart. */
const ready = () => screen.findByPlaceholderText(t.acPlaceholder)
const guessInput = () => screen.queryByPlaceholderText(t.acPlaceholder)

beforeEach(() => {
  localStorage.clear()
})

afterEach(() => {
  vi.unstubAllGlobals()
  vi.clearAllMocks()
})

describe('App — starting a game', () => {
  it('shows a loading state, then the board', async () => {
    mockApi()
    renderApp()
    expect(screen.getByText(t.loading)).toBeInTheDocument()
    await ready()
    expect(screen.getByText(t.guessesLeft(MAX_GUESSES, MAX_GUESSES))).toBeInTheDocument()
  })

  it('registers a player once and remembers them across reloads', async () => {
    const fetchMock = mockApi()
    renderApp()
    await ready()

    expect(localStorage.getItem('maple-playerId')).toBe('p1')
    const playerCalls = () => fetchMock.mock.calls.filter(c => String(c[0]).includes('/api/player'))
    expect(playerCalls()).toHaveLength(1)
  })

  it('reuses a stored player id instead of creating another', async () => {
    localStorage.setItem('maple-playerId', 'returning')
    const fetchMock = mockApi()
    renderApp()
    await ready()

    expect(fetchMock.mock.calls.some(c => String(c[0]).includes('/api/player'))).toBe(false)
    const sessionCall = fetchMock.mock.calls.find(c => String(c[0]).includes('/api/session'))!
    expect(JSON.parse(sessionCall[1]!.body as string)).toEqual({ playerId: 'returning' })
  })

  it('says so when the session cannot be started', async () => {
    mockApi({ '/api/session': () => { throw new Error('offline') } })
    renderApp()
    expect(await screen.findByText(t.errFailedSession)).toBeInTheDocument()
  })

  it('still lets the game start when the city list fails to load', async () => {
    mockApi({ '/api/cities': () => { throw new Error('offline') } })
    renderApp()
    await ready()
    expect(screen.queryByText(t.errFailedSession)).not.toBeInTheDocument()
  })
})

describe('App — playing', () => {
  it('records a miss in the guess table with its hints', async () => {
    mockApi()
    const user = renderApp()
    const input = await ready()

    await user.type(input, 'montreal{Enter}')

    const row = await screen.findByRole('row', { name: /Montréal/ })
    expect(within(row).getByText('QC')).toBeInTheDocument()   // province tag
    expect(within(row).getByText(/504/)).toBeInTheDocument()  // distance
  })

  it('sends the city id the autocomplete picked, not just the typed text', async () => {
    const fetchMock = mockApi()
    const user = renderApp()
    const input = await ready()

    await user.type(input, 'montreal{Enter}')

    await waitFor(() => {
      const call = fetchMock.mock.calls.find(c => String(c[0]).includes('/api/guess'))!
      expect(JSON.parse(call[1]!.body as string)).toEqual({
        sessionId: 's1', cityId: 2, city: 'Montréal',
      })
    })
  })

  it('counts down the guesses left', async () => {
    mockApi()
    const user = renderApp()
    const input = await ready()

    await user.type(input, 'montreal{Enter}')

    expect(
      await screen.findByText(t.guessesLeft(MAX_GUESSES - 1, MAX_GUESSES)),
    ).toBeInTheDocument()
  })

  it('shows the API\'s own message when a guess is rejected', async () => {
    mockApi({ '/api/guess': { status: 400, payload: { code: 'CITY_NOT_FOUND' } } })
    const user = renderApp()
    const input = await ready()

    await user.type(input, 'Narnia')
    await user.keyboard('{Escape}{Enter}')

    expect(await screen.findByText(t.errCityNotFound)).toBeInTheDocument()
  })

  it('reports a network failure without losing the board', async () => {
    mockApi({ '/api/guess': () => { throw new Error('offline') } })
    const user = renderApp()
    const input = await ready()

    await user.type(input, 'montreal{Enter}')

    expect(await screen.findByText(t.errNetwork)).toBeInTheDocument()
    expect(guessInput()).toBeInTheDocument()
  })
})

describe('App — finishing', () => {
  it('celebrates a win, reveals the answer and hides the input', async () => {
    mockApi({ '/api/guess': HIT })
    const user = renderApp()
    const input = await ready()

    await user.type(input, 'toronto{Enter}')

    expect(await screen.findByRole('dialog')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: t.modalTitleWon })).toBeInTheDocument()
    expect(guessInput()).not.toBeInTheDocument()
  })

  it('lets the result be dismissed and reopened', async () => {
    mockApi({ '/api/guess': HIT })
    const user = renderApp()
    const input = await ready()
    await user.type(input, 'toronto{Enter}')
    await screen.findByRole('dialog')

    await user.click(screen.getByRole('button', { name: t.close }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: t.solvedBanner(1) }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('restores a finished game on reload without popping the modal', async () => {
    mockApi({
      '/api/session': {
        ...SESSION,
        completed: true,
        won: true,
        answer: { name: 'Toronto', province: 'Ontario', latitude: 43.7, longitude: -79.4 },
        guesses: [{ ...MISS }, { ...HIT }],
      },
    })
    renderApp()

    expect(await screen.findByRole('button', { name: t.solvedBanner(2) })).toBeInTheDocument()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(guessInput()).not.toBeInTheDocument()
  })

  it('restores an unfinished game with its guesses intact', async () => {
    mockApi({ '/api/session': { ...SESSION, guesses: [{ ...MISS }] } })
    renderApp()

    await ready()
    expect(screen.getByRole('row', { name: /Montréal/ })).toBeInTheDocument()
    expect(screen.getByText(t.guessesLeft(MAX_GUESSES - 1, MAX_GUESSES))).toBeInTheDocument()
  })

  it('shows the out-of-guesses banner on a loss', async () => {
    mockApi({
      '/api/session': { ...SESSION, completed: true, won: false, guesses: [{ ...MISS }] },
    })
    renderApp()

    expect(await screen.findByRole('button', { name: t.outOfGuessesBanner })).toBeInTheDocument()
  })
})

describe('App — language', () => {
  it('switches every label to French without reloading the game', async () => {
    mockApi()
    const user = renderApp()
    await ready()

    await user.selectOptions(screen.getByLabelText(t.languageLabel), 'fr')

    expect(await screen.findByText(dicts.fr.guessesLeft(MAX_GUESSES, MAX_GUESSES))).toBeInTheDocument()
    expect(document.documentElement.lang).toBe('fr')
  })
})
