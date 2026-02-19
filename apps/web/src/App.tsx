import { useState, useEffect } from 'react'
import { MapContainer, TileLayer, CircleMarker, Tooltip } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import './App.css'

interface GuessResult {
  city: string
  correct: boolean
  distanceKm: number
  direction: string
  provinceMatch: boolean
  populationHint: 'larger' | 'smaller' | 'equal'
  latitude: number
  longitude: number
}

// Returns a color from red → orange → yellow → green based on distance
// 0 km = bold green, ~MAX_DISTANCE km or more = bold red
function distanceToColor(distanceKm: number, correct: boolean): string {
  if (correct) return '#2e7d32'
  // Canada is ~5500km across; cap at 5000km for the gradient
  const maxDist = 5000
  const t = Math.min(distanceKm / maxDist, 1) // 0 = close, 1 = far

  // Interpolate hue: 120 (green) → 60 (yellow) → 30 (orange) → 0 (red)
  const hue = Math.round(120 * (1 - t))
  return `hsl(${hue}, 100%, 40%)`
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
        <MapContainer center={[56, -96]} zoom={4} scrollWheelZoom={true} style={{ height: '600px', width: '100%' }}>
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          {guesses.map((g, i) => {
            const color = distanceToColor(g.distanceKm, g.correct)
            return (
              <CircleMarker
                key={i}
                center={[g.latitude, g.longitude]}
                radius={8}
                pathOptions={{
                  color,
                  fillColor: color,
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
