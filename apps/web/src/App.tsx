import { useState, useEffect, useMemo, useRef } from 'react'
import { ComposableMap, Geographies, Geography, Marker, ZoomableGroup, useZoomPanContext } from 'react-simple-maps'
import { geoConicConformal } from 'd3-geo'
import { CityAutocomplete, type CityOption } from './CityAutocomplete'
import { WinModal, type PlayerStats } from './WinModal'
import { MapleLeaf } from './MapleLeaf'
import { LanguagePicker } from './LanguagePicker'
import { useLang } from './i18n/LanguageContext'
import { MAX_GUESSES } from '@maple/types'
import './App.css'

// The target city, revealed once the game is over.
interface Answer {
  name: string
  latitude: number
  longitude: number
}

// How far double-click / wheel zoom can go. High enough that a cluster of
// guesses only 15-30 km apart spreads out into distinct, clickable pins.
const MAX_ZOOM = 40

// Reference date for the shareable puzzle number (Maple #N). Day 1 = launch.
const LAUNCH_EPOCH = Date.UTC(2026, 0, 1)

interface GuessResult {
  city: string
  correct: boolean
  distanceKm: number
  direction: string
  provinceMatch: boolean
  province: string
  provinceDistance: number
  populationHint: 'larger' | 'smaller' | 'equal'
  latitude: number
  longitude: number
}

// Fill colour for a province given how many provinces away it is from the target.
function provinceFill(dist: number | undefined): string {
  if (dist === undefined) return '#dfe6e9' // not yet implicated — neutral land
  if (dist === 0) return '#800026'
  if (dist === 1) return '#E31A1C'
  if (dist === 2) return '#FED976'
  return '#FFEDA0'
}

const LEGEND_ITEMS: { color: string; key: 'legendSame' | 'legend1' | 'legend2' | 'legend3plus' }[] = [
  { color: '#800026', key: 'legendSame' },
  { color: '#E31A1C', key: 'legend1' },
  { color: '#FED976', key: 'legend2' },
  { color: '#FFEDA0', key: 'legend3plus' },
]

function MapLegend() {
  const { t } = useLang()
  return (
    <div className="map-legend">
      <strong>{t.legendTitle}</strong>
      {LEGEND_ITEMS.map(({ color, key }) => (
        <div className="legend-row" key={key}>
          <span className="legend-swatch" style={{ background: color }} />
          {t[key]}
        </div>
      ))}
    </div>
  )
}

// Provinces + guess pins, rendered inside <ZoomableGroup>. The group applies an
// SVG transform that scales everything by the current zoom `k`, so we divide all
// stroke widths and pin radii by `k` to keep them a constant size on screen —
// that's what lets a tight cluster of guesses stay readable as you zoom in.
function MapContent({
  provincesGeoJSON,
  provinceDistances,
  guesses,
  answer,
}: {
  provincesGeoJSON: object
  provinceDistances: Record<string, number>
  guesses: GuessResult[]
  answer: Answer | null
}) {
  const { k } = useZoomPanContext()
  const [hovered, setHovered] = useState<number | null>(null)
  return (
    <>
      <Geographies geography={provincesGeoJSON as never}>
        {({ geographies }) =>
          geographies.map((geo) => {
            const name: string = geo.properties.name
            const dist = provinceDistances[name]
            return (
              <Geography
                key={geo.rsmKey}
                geography={geo}
                fill={provinceFill(dist)}
                stroke="#5c6b73"
                strokeWidth={0.5 / k}
                style={{
                  default: { outline: 'none' },
                  hover: { fill: '#34495e', stroke: '#2c3e50', strokeWidth: 1 / k, outline: 'none' },
                  pressed: { outline: 'none' },
                }}
              >
                <title>{name}</title>
              </Geography>
            )
          })
        }
      </Geographies>
      {guesses.map((g, i) => (
        <Marker key={i} coordinates={[g.longitude, g.latitude]}>
          <circle
            r={(g.correct ? 6 : 4) / k}
            fill={g.correct ? '#f1c40f' : '#111'}
            stroke="#fff"
            strokeWidth={1.5 / k}
            style={{ cursor: 'pointer' }}
            onMouseEnter={() => setHovered(i)}
            onMouseLeave={() => setHovered((h) => (h === i ? null : h))}
          />
        </Marker>
      ))}
      {/* Hovered pin drawn on top of the whole cluster so its label is never
          occluded by neighbouring pins — the case that matters most when zoomed
          into a dense group. Counter-scaled, with a white halo (paint-order:
          stroke) so the city name stays legible over any map colour. */}
      {hovered !== null && guesses[hovered] && (
        <Marker coordinates={[guesses[hovered].longitude, guesses[hovered].latitude]}>
          <circle
            r={((guesses[hovered].correct ? 6 : 4) * 1.4) / k}
            fill={guesses[hovered].correct ? '#f1c40f' : '#111'}
            stroke="#fff"
            strokeWidth={1.5 / k}
            style={{ pointerEvents: 'none' }}
          />
          <text
            x={10 / k}
            dominantBaseline="middle"
            fontSize={12 / k}
            fontWeight={700}
            fill="#111"
            stroke="#fff"
            strokeWidth={3 / k}
            paintOrder="stroke"
            style={{ pointerEvents: 'none' }}
          >
            {guesses[hovered].city}
          </text>
        </Marker>
      )}
      {/* Reveal the answer's location when the game was lost. Gold star so it
          reads as "the target", distinct from the black guess pins. */}
      {answer && (
        <Marker coordinates={[answer.longitude, answer.latitude]}>
          <circle r={7 / k} fill="#f1c40f" stroke="#fff" strokeWidth={1.5 / k} />
          <text
            x={11 / k}
            dominantBaseline="middle"
            fontSize={12 / k}
            fontWeight={700}
            fill="#b7791f"
            stroke="#fff"
            strokeWidth={3 / k}
            paintOrder="stroke"
            style={{ pointerEvents: 'none' }}
          >
            {answer.name}
          </text>
        </Marker>
      )}
    </>
  )
}

// Measure an element's content box; used to fit the projection to the viewport.
function useElementSize() {
  const ref = useRef<HTMLDivElement>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect
      setSize({ w: Math.round(width), h: Math.round(height) })
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, size] as const
}

async function getOrCreatePlayerId(): Promise<string> {
  const stored = localStorage.getItem('maple-playerId')
  if (stored) return stored

  const res = await fetch('/api/player', { method: 'POST' })
  const data = await res.json()
  localStorage.setItem('maple-playerId', data.playerId)
  return data.playerId
}

function App() {
  const { t } = useLang()
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [cities, setCities] = useState<CityOption[]>([])
  const [guesses, setGuesses] = useState<GuessResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [gameOver, setGameOver] = useState(false)
  const [won, setWon] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [stats, setStats] = useState<PlayerStats | null>(null)
  const [puzzleDate, setPuzzleDate] = useState<string | null>(null)
  const [showModal, setShowModal] = useState(false)
  const [loading, setLoading] = useState(true)
  const [provincesGeoJSON, setProvincesGeoJSON] = useState<object | null>(null)
  // Map viewport, driven by double-click / wheel / drag. `center` is the geo
  // coordinate at the middle of the pane; null until the projection is ready.
  const [zoom, setZoom] = useState(1)
  const [center, setCenter] = useState<[number, number] | null>(null)
  const homeCenter = useRef<[number, number] | null>(null)
  const [mapRef, mapSize] = useElementSize()

  useEffect(() => {
    fetch('/canada-provinces.geojson').then(r => r.json()).then(setProvincesGeoJSON)
  }, [])

  // Full list of guessable cities, for the autocomplete dropdown.
  useEffect(() => {
    fetch('/api/cities')
      .then(r => r.json())
      .then((data: CityOption[]) => setCities(data))
      .catch(() => setCities([]))
  }, [])

  // Normalized names already guessed, so the dropdown can flag repeats.
  const guessedNames = useMemo(() => {
    return new Set(
      guesses.map(g =>
        g.city.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim(),
      ),
    )
  }, [guesses])

  // Fall back to a sensible size until the ResizeObserver reports the real one,
  // so the map renders immediately rather than waiting on measurement.
  const mapW = mapSize.w || 800
  const mapH = mapSize.h || 600

  // Lambert conformal conic (the standard Canada projection), fit to the whole
  // country. Zooming into a region is handled on top of this by <ZoomableGroup>
  // (SVG transform), not by re-fitting the projection.
  const projection = useMemo(() => {
    if (!provincesGeoJSON) return null
    const pad = 12
    return geoConicConformal()
      .parallels([49, 77])
      .rotate([96, 0])
      .fitExtent(
        [[pad, pad], [mapW - pad, mapH - pad]],
        provincesGeoJSON as never,
      )
  }, [provincesGeoJSON, mapW, mapH])

  // Once the projection exists, seed the viewport centre from the pane's middle
  // pixel so that zoom=1 is the untransformed all-Canada view (no initial jump).
  // invert(middle) is essentially size-independent, so this stays valid across
  // resizes without recomputing.
  useEffect(() => {
    if (projection && !center) {
      const home = projection.invert?.([mapW / 2, mapH / 2]) as [number, number] | undefined
      if (home) {
        homeCenter.current = home
        setCenter(home)
      }
    }
  }, [projection, center, mapW, mapH])

  function resetView() {
    setZoom(1)
    if (homeCenter.current) setCenter(homeCenter.current)
  }

  // Best (lowest) provinceDistance seen per province name
  const provinceDistances = useMemo(() => {
    const result: Record<string, number> = {}
    for (const g of guesses) {
      const prev = result[g.province]
      if (prev === undefined || g.provinceDistance < prev) {
        result[g.province] = g.provinceDistance
      }
    }
    return result
  }, [guesses])

  useEffect(() => {
    async function init() {
      try {
        const playerId = await getOrCreatePlayerId()

        const res = await fetch('/api/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ playerId }),
        })
        const data = await res.json()

        setSessionId(data.sessionId)
        setPuzzleDate(data.puzzleDate)
        if (data.stats) setStats(data.stats)

        if (data.guesses && data.guesses.length > 0) {
          setGuesses(data.guesses)
        }

        // Game already finished today: restore win/loss + the revealed answer,
        // but don't pop the modal automatically on a reload.
        if (data.completed) {
          setGameOver(true)
          setWon(data.won)
          setAnswer(data.answer ?? null)
        }
      } catch {
        setError(t.errFailedSession)
      } finally {
        setLoading(false)
      }
    }
    init()
    // Mount-only: session init runs once. `t` is read for the failure message
    // but must not re-trigger init on a language switch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function submitGuess(guess: { cityId?: number; cityName: string }) {
    if (!guess.cityName.trim() || !sessionId || gameOver) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, cityId: guess.cityId, city: guess.cityName.trim() }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || t.errGeneric)
        return
      }

      // The response carries the canonical city name, so the guess list shows
      // the real spelling (e.g. "Montréal") rather than whatever was typed.
      const data = await res.json()
      const entry: GuessResult = data
      setGuesses(prev => [...prev, entry])

      if (data.gameOver) {
        if (data.stats) setStats(data.stats)
        setWon(data.won)
        setAnswer(data.answer ?? null)
        setGameOver(true)
        setShowModal(true)
      }
    } catch {
      setError(t.errNetwork)
    } finally {
      setLoading(false)
    }
  }

  if (loading && !sessionId) {
    return (
      <div className="app">
        <header className="app-header">
          <h1 className="app-title"><MapleLeaf size={30} /> {t.appTitle}</h1>
          <LanguagePicker />
        </header>
        <p>{t.loading}</p>
      </div>
    )
  }

  const puzzleNumber = puzzleDate
    ? Math.floor((Date.parse(puzzleDate) - LAUNCH_EPOCH) / 86_400_000) + 1
    : 0
  const answerCity = answer?.name ?? guesses.find(g => g.correct)?.city ?? ''
  const guessesLeft = MAX_GUESSES - guesses.length

  return (
    <div className="app">
      <header className="app-header">
        <h1 className="app-title"><MapleLeaf size={30} /> {t.appTitle}</h1>
        <LanguagePicker />
      </header>

      {gameOver && (
        <button
          type="button"
          className={`compact-status result-reopen ${won ? 'success' : 'defeat'}`}
          onClick={() => setShowModal(true)}
        >
          {won ? t.solvedBanner(guesses.length) : t.outOfGuessesBanner}
        </button>
      )}

      {!gameOver && (
        <>
          <CityAutocomplete
            cities={cities}
            guessedNames={guessedNames}
            disabled={loading}
            onSubmit={submitGuess}
          />
          <p className="guesses-left">
            {t.guessesLeft(guessesLeft, MAX_GUESSES)}
          </p>
        </>
      )}

      {showModal && (
        <WinModal
          onClose={() => setShowModal(false)}
          won={won}
          city={answerCity}
          guessCount={guesses.length}
          puzzleNumber={puzzleNumber}
          stats={stats}
          guesses={guesses}
        />
      )}

      {error && <p className="error">{error}</p>}

      <div className="game-body">
      <div className="map-container" ref={mapRef}>
        {projection && center && (
          <ComposableMap
            projection={projection as never}
            width={mapW}
            height={mapH}
            style={{ width: '100%', height: '100%' }}
          >
            <ZoomableGroup
              zoom={zoom}
              center={center}
              minZoom={1}
              maxZoom={MAX_ZOOM}
              // Double-click / wheel / drag are handled internally; mirror the
              // resulting viewport back into state so it survives re-renders and
              // the reset button knows where we are.
              onMoveEnd={(pos) => {
                setZoom(pos.zoom)
                setCenter(pos.coordinates)
              }}
            >
              <MapContent
                provincesGeoJSON={provincesGeoJSON as object}
                provinceDistances={provinceDistances}
                guesses={guesses}
                answer={gameOver && !won ? answer : null}
              />
            </ZoomableGroup>
          </ComposableMap>
        )}
        {zoom > 1.01 && (
          <button type="button" className="map-back" onClick={resetView}>
            {t.mapBack}
          </button>
        )}
        <p className="map-hint">{t.mapHint}</p>
        <MapLegend />
      </div>

      <div className="guess-pane">
      {guesses.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>{t.thNum}</th>
              <th>{t.thCity}</th>
              <th>{t.thProvince}</th>
              <th>{t.thDistance}</th>
              <th>{t.thDirection}</th>
              <th>{t.thPopulation}</th>
            </tr>
          </thead>
          <tbody>
            {guesses.map((g, i) => (
              <tr key={i} className={g.correct ? 'correct-row' : ''}>
                <td>{i + 1}</td>
                <td>{g.city}</td>
                <td>{g.provinceMatch ? '✅' : '❌'}</td>
                <td>{g.distanceKm} km</td>
                <td>{g.direction}</td>
                <td>{g.correct ? '—' : g.populationHint === 'larger' ? t.popLarger : g.populationHint === 'smaller' ? t.popSmaller : '='}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="guess-empty">{t.guessesEmpty}</p>
      )}
      </div>
      </div>
    </div>
  )
}

export default App
