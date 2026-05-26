import { useState, useEffect, useMemo } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip, GeoJSON, Polygon, useMap } from 'react-leaflet'
import L, { LatLngBoundsExpression } from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

const WORLD_RING: [number, number][] = [[-90, -180], [-90, 180], [90, 180], [90, -180]]

function extractRings(geojson: any): [number, number][][] {
  const rings: [number, number][][] = []
  for (const feature of geojson.features ?? []) {
    const geom = feature.geometry ?? feature
    if (geom.type === 'Polygon') {
      rings.push(geom.coordinates[0].map(([lon, lat]: [number, number]) => [lat, lon] as [number, number]))
    } else if (geom.type === 'MultiPolygon') {
      for (const polygon of geom.coordinates) {
        rings.push(polygon[0].map(([lon, lat]: [number, number]) => [lat, lon] as [number, number]))
      }
    }
  }
  return rings
}

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
  const [canadaGeoJSON, setCanadaGeoJSON] = useState<object | null>(null)
  const [provincesGeoJSON, setProvincesGeoJSON] = useState<object | null>(null)

  useEffect(() => {
    fetch('/canada.geojson').then(r => r.json()).then(setCanadaGeoJSON)
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
      <h1>🍁 Maple</h1>

      {solved && (
        <p className="success">🎉 You got it in {guesses.length} guess{guesses.length > 1 ? 'es' : ''}!</p>
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

      <div className="map-container">
        <MapContainer
          center={[56, -96]}
          zoom={4}
          scrollWheelZoom={true}
          style={{ height: '600px', width: '100%' }}
          maxBounds={[[41.0, -141.0], [83.0, -52.0]] as LatLngBoundsExpression}
          maxBoundsViscosity={1.0}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {/* Dark mask outside Canada */}
          {canadaGeoJSON && (
            <Polygon
              positions={[WORLD_RING, ...extractRings(canadaGeoJSON)]}
              pathOptions={{ stroke: false, fillColor: '#000', fillOpacity: 0.6 }}
            />
          )}
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

      {guesses.length > 0 && (
        <table>
          <thead>
            <tr>
              <th>#</th>
              <th>City</th>
              <th>Correct</th>
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
                <td>{g.correct ? '✅' : '❌'}</td>
                <td>{g.provinceMatch ? '✅' : '❌'}</td>
                <td>{g.distanceKm} km</td>
                <td>{g.direction}</td>
                <td>{g.correct ? '—' : g.populationHint === 'larger' ? '⬆️ larger' : g.populationHint === 'smaller' ? '⬇️ smaller' : '='}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

export default App
