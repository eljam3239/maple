import { useState, useEffect } from 'react'
import './App.css'

interface GuessResult {
  city: string
  correct: boolean
  distanceKm: number
  direction: string
  provinceMatch: boolean
  populationHint: 'larger' | 'smaller' | 'equal'
}

function App() {
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [guess, setGuess] = useState('')
  const [guesses, setGuesses] = useState<GuessResult[]>([])
  const [error, setError] = useState<string | null>(null)
  const [solved, setSolved] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch('/api/session', { method: 'POST' })
      .then(res => res.json())
      .then(data => setSessionId(data.sessionId))
      .catch(() => setError('Failed to create session'))
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

  return (
    <div className="app">
      <h1>🍁 Maple</h1>

      {!sessionId ? (
        <p>Starting session...</p>
      ) : (
        <>
          <form onSubmit={handleGuess} className="guess-form">
            <input
              type="text"
              value={guess}
              onChange={e => setGuess(e.target.value)}
              placeholder="Guess a Canadian city..."
              disabled={solved || loading}
            />
            <button type="submit" disabled={solved || loading || !guess.trim()}>
              {loading ? '...' : 'Guess'}
            </button>
          </form>

          {error && <p className="error">{error}</p>}

          {solved && (
            <p className="success">🎉 You got it in {guesses.length} guess{guesses.length > 1 ? 'es' : ''}!</p>
          )}

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
        </>
      )}
    </div>
  )
}

export default App
