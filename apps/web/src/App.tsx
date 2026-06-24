import { useState, useEffect, useMemo, useRef } from 'react'
import { ComposableMap, Geographies, Geography, Marker } from 'react-simple-maps'
import { geoConicConformal } from 'd3-geo'
import './App.css'

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

interface GeoFeature {
  properties: { name: string }
}

// Fill colour for a province given how many provinces away it is from the target.
function provinceFill(dist: number | undefined): string {
  if (dist === undefined) return '#dfe6e9' // not yet implicated — neutral land
  if (dist === 0) return '#800026'
  if (dist === 1) return '#E31A1C'
  if (dist === 2) return '#FED976'
  return '#FFEDA0'
}

const LEGEND_ITEMS = [
  { color: '#800026', label: 'Same province' },
  { color: '#E31A1C', label: '1 province away' },
  { color: '#FED976', label: '2 provinces away' },
  { color: '#FFEDA0', label: '3+ provinces away' },
]

function MapLegend() {
  return (
    <div className="map-legend">
      <strong>Province distance</strong>
      {LEGEND_ITEMS.map(({ color, label }) => (
        <div className="legend-row" key={label}>
          <span className="legend-swatch" style={{ background: color }} />
          {label}
        </div>
      ))}
    </div>
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
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [guess, setGuess] = useState('')
  const [guesses, setGuesses] = useState<GuessResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const [loading, setLoading] = useState(true)
  const [provincesGeoJSON, setProvincesGeoJSON] = useState<object | null>(null)
  const [focusedProvince, setFocusedProvince] = useState<string | null>(null)
  const [mapRef, mapSize] = useElementSize()

  useEffect(() => {
    fetch('/canada-provinces.geojson').then(r => r.json()).then(setProvincesGeoJSON)
  }, [])

  // Fall back to a sensible size until the ResizeObserver reports the real one,
  // so the map renders immediately rather than waiting on measurement.
  const mapW = mapSize.w || 800
  const mapH = mapSize.h || 600

  // Lambert conformal conic (the standard Canada projection), fit to the
  // viewport. When a province is focused we fit to that province alone, so its
  // guess pins spread out to fill the pane; otherwise we fit to all of Canada.
  const projection = useMemo(() => {
    if (!provincesGeoJSON) return null
    const features = (provincesGeoJSON as { features: GeoFeature[] }).features
    const focused = focusedProvince
      ? features.find((f) => f.properties.name === focusedProvince)
      : null
    const fitTarget = focused ?? provincesGeoJSON
    // Tighter padding when drilled in so the province uses the full pane.
    const pad = focused ? 24 : 12
    return geoConicConformal()
      .parallels([49, 77])
      .rotate([96, 0])
      .fitExtent(
        [[pad, pad], [mapW - pad, mapH - pad]],
        fitTarget as never,
      )
  }, [provincesGeoJSON, focusedProvince, mapW, mapH])

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

        if (data.guesses && data.guesses.length > 0) {
          setGuesses(data.guesses)
        }

        if (data.completed) {
          setSolved(true)
        }
      } catch {
        setError('Failed to start session')
      } finally {
        setLoading(false)
      }
    }
    init()
  }, [])

  async function handleGuess(e: React.FormEvent) {
    e.preventDefault()
    if (!guess.trim() || !sessionId || solved) return

    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/guess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId, city: guess.trim() }),
      })

      if (!res.ok) {
        const err = await res.json()
        setError(err.error || 'Something went wrong')
        return
      }

      const result = await res.json()
      const entry: GuessResult = { city: guess.trim(), ...result }
      setGuesses(prev => [...prev, entry])
      setGuess('')

      if (result.correct) setSolved(true)
    } catch {
      setError('Network error')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !sessionId) {
    return (
      <div className="app">
        <h1>🍁 Maple</h1>
        <p>Loading...</p>
      </div>
    )
  }

  return (
    <div className="app">
      <h1 className="app-title">🍁 Maple</h1>

      {solved && (
        <p className="success compact-status">🎉 You got it in {guesses.length} guess{guesses.length > 1 ? 'es' : ''}!</p>
      )}

      {!solved && (
        <form onSubmit={handleGuess} className="guess-form">
          <input
            type="text"
            value={guess}
            onChange={e => setGuess(e.target.value)}
            placeholder="Guess a Canadian city..."
            disabled={loading}
          />
          <button type="submit" disabled={loading || !guess.trim()}>
            {loading ? '...' : 'Guess'}
          </button>
        </form>
      )}

      {error && <p className="error">{error}</p>}

      <div className="game-body">
      <div className="map-container" ref={mapRef}>
        {projection && (
          <ComposableMap
            projection={projection as never}
            width={mapW}
            height={mapH}
            style={{ width: '100%', height: '100%' }}
          >
            <Geographies geography={provincesGeoJSON as never}>
              {({ geographies }) =>
                geographies.map((geo) => {
                  const name: string = geo.properties.name
                  const dist = provinceDistances[name]
                  return (
                    <Geography
                      key={geo.rsmKey}
                      geography={geo}
                      onDoubleClick={() =>
                        setFocusedProvince((cur) => (cur === name ? null : name))
                      }
                      fill={provinceFill(dist)}
                      stroke="#5c6b73"
                      strokeWidth={0.5}
                      style={{
                        default: { outline: 'none', cursor: 'pointer' },
                        hover: { fill: '#34495e', stroke: '#2c3e50', strokeWidth: 1, outline: 'none', cursor: 'pointer' },
                        pressed: { outline: 'none' },
                      }}
                    >
                      <title>{focusedProvince === name ? `${name} — double-click to zoom out` : `${name} — double-click to zoom in`}</title>
                    </Geography>
                  )
                })
              }
            </Geographies>
            {guesses.map((g, i) => (
              <Marker key={i} coordinates={[g.longitude, g.latitude]}>
                <circle
                  r={g.correct ? 6 : 4}
                  fill={g.correct ? '#f1c40f' : '#111'}
                  stroke="#fff"
                  strokeWidth={1.5}
                />
                <title>{g.city}</title>
              </Marker>
            ))}
          </ComposableMap>
        )}
        {focusedProvince && (
          <button
            type="button"
            className="map-back"
            onClick={() => setFocusedProvince(null)}
          >
            ← Canada
          </button>
        )}
        <MapLegend />
      </div>

      <div className="guess-pane">
      {guesses.length > 0 ? (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>City</th>
              <th>Province</th>
              <th>Distance</th>
              <th>Direction</th>
              <th>Population</th>
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
                <td>{g.correct ? '—' : g.populationHint === 'larger' ? '⬆️ larger' : g.populationHint === 'smaller' ? '⬇️ smaller' : '='}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <p className="guess-empty">Your guesses will appear here.</p>
      )}
      </div>
      </div>
    </div>
  )
}

export default App
