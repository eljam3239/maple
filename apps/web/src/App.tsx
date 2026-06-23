import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, GeoJSON, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
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

function getProvinceStyle(dist: number | undefined) {
  const fillColor =
    dist === undefined ? '#888' :
    dist === 0 ? '#800026' :
    dist === 1 ? '#E31A1C' :
    dist === 2 ? '#FED976' :
    '#FFEDA0'
  return {
    fillColor,
    fillOpacity: dist === undefined ? 0.15 : 0.75,
    weight: 1,
    color: '#555',
    dashArray: '3',
    opacity: 1,
  }
}

const LEGEND_ITEMS = [
  { color: '#800026', label: 'Same province' },
  { color: '#E31A1C', label: '1 province away' },
  { color: '#FED976', label: '2 provinces away' },
  { color: '#FFEDA0', label: '3+ provinces away' },
]

function MapLegend() {
  const map = useMap()
  useEffect(() => {
    const legend = L.control({ position: 'bottomright' })
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'map-legend')
      div.innerHTML =
        '<strong>Province distance</strong>' +
        LEGEND_ITEMS.map(
          ({ color, label }) =>
            `<div class="legend-row"><span class="legend-swatch" style="background:${color}"></span>${label}</div>`
        ).join('')
      return div
    }
    legend.addTo(map)
    return () => { legend.remove() }
  }, [map])
  return null
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

  useEffect(() => {
    fetch('/canada-provinces.geojson').then(r => r.json()).then(setProvincesGeoJSON)
  }, [])

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
      <div className="map-container">
        <MapContainer
          center={[56, -96]}
          zoom={4}
          scrollWheelZoom={true}
          style={{ height: '100%', width: '100%' }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Province choropleth — key forces remount on each guess so styles refresh */}
          {provincesGeoJSON && (
            <GeoJSON
              key={guesses.length}
              data={provincesGeoJSON as any}
              onEachFeature={(feature, layer) => {
                const name: string = feature?.properties?.name
                ;(layer as L.Path).setStyle(getProvinceStyle(provinceDistances[name]))
                layer.on({
                  mouseover: (e) => {
                    e.target.setStyle({ weight: 3, color: '#333', dashArray: '' })
                    e.target.bringToFront()
                  },
                  mouseout: (e) => {
                    e.target.setStyle(getProvinceStyle(provinceDistances[name]))
                  },
                })
              }}
            />
          )}
          <MapLegend />
          {guesses.map((g, i) => {
            return (
              <CircleMarker
                key={i}
                center={[g.latitude, g.longitude]}
                radius={4}
                pathOptions={{
                    color: '#000',
                    fillColor: '#000',
                    fillOpacity: 0.8,
                  }}
              >
                <Tooltip>{g.city}</Tooltip>
              </CircleMarker>
            )
          })}
        </MapContainer>
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
