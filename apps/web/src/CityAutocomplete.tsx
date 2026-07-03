import { useEffect, useMemo, useRef, useState } from 'react'

export interface CityOption {
  name: string
  province: string
}

interface Props {
  cities: CityOption[]
  guessedNames: Set<string>
  disabled?: boolean
  onSubmit: (cityName: string) => void
}

const MAX_RESULTS = 8

// Lowercase + strip accents so "montreal" matches "Montréal" and casing is
// irrelevant. Used for both the query and the candidate names.
function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// Rank: prefix matches (by whole string, then by any word) above interior
// substring matches. Non-matches are dropped.
function rank(query: string, name: string): number {
  const q = normalize(query)
  const n = normalize(name)
  if (!q) return -1
  if (n.startsWith(q)) return 0
  if (n.split(/\s+/).some(word => word.startsWith(q))) return 1
  if (n.includes(q)) return 2
  return -1
}

export function CityAutocomplete({ cities, guessedNames, disabled, onSubmit }: Props) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const matches = useMemo(() => {
    if (!query.trim()) return []
    return cities
      .map(city => ({ city, score: rank(query, city.name) }))
      .filter(m => m.score >= 0)
      .sort((a, b) => a.score - b.score) // stable: preserves population order within a tier
      .slice(0, MAX_RESULTS)
      .map(m => m.city)
  }, [cities, query])

  // Keep the highlighted row scrolled into view as it moves.
  useEffect(() => {
    const el = listRef.current?.children[highlight] as HTMLElement | undefined
    el?.scrollIntoView({ block: 'nearest' })
  }, [highlight])

  // Close the dropdown when clicking outside the widget.
  useEffect(() => {
    function onClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [])

  const showList = open && matches.length > 0

  function choose(cityName: string) {
    onSubmit(cityName)
    setQuery('')
    setOpen(false)
    setHighlight(0)
  }

  function submitQuery() {
    if (showList) {
      choose(matches[highlight].name)
    } else if (query.trim()) {
      // No suggestion open — submit the raw text so exact typing still works.
      choose(query.trim())
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setOpen(true)
      setHighlight(h => Math.min(h + 1, matches.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlight(h => Math.max(h - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      submitQuery()
    } else if (e.key === 'Escape') {
      setOpen(false)
    }
  }

  return (
    <div className="city-autocomplete" ref={rootRef}>
      <div className="guess-form">
        <input
          type="text"
          value={query}
          onChange={e => {
            setQuery(e.target.value)
            setOpen(true)
            setHighlight(0)
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
          placeholder="Guess a Canadian city..."
          disabled={disabled}
          role="combobox"
          aria-expanded={showList}
          aria-controls="city-autocomplete-list"
          aria-autocomplete="list"
          autoComplete="off"
        />
        <button type="button" onClick={submitQuery} disabled={disabled || !query.trim()}>
          Guess
        </button>
      </div>

      {showList && (
        <ul className="autocomplete-list" id="city-autocomplete-list" ref={listRef} role="listbox">
          {matches.map((city, i) => {
            const already = guessedNames.has(normalize(city.name))
            return (
              <li
                key={`${city.name}-${city.province}`}
                role="option"
                aria-selected={i === highlight}
                className={
                  (i === highlight ? 'active' : '') + (already ? ' guessed' : '')
                }
                // onMouseDown (not onClick) so it fires before the input blur.
                onMouseDown={e => {
                  e.preventDefault()
                  choose(city.name)
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span className="ac-city">{city.name}</span>
                <span className="ac-province">{city.province}</span>
                {already && <span className="ac-guessed-tag">guessed</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
