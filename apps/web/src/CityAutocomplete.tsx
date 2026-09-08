import { useEffect, useMemo, useRef, useState } from 'react'
import { useLang } from './i18n/LanguageContext'
import { matchCities, normalize, type CityOption } from './search'

export type { CityOption }

interface Props {
  cities: CityOption[]
  guessedNames: Set<string>
  disabled?: boolean
  onSubmit: (guess: { cityId?: number; cityName: string }) => void
}

export function CityAutocomplete({ cities, guessedNames, disabled, onSubmit }: Props) {
  const { t } = useLang()
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlight, setHighlight] = useState(0)
  const rootRef = useRef<HTMLDivElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  const matches = useMemo(() => matchCities(query, cities), [cities, query])

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

  function reset() {
    setQuery('')
    setOpen(false)
    setHighlight(0)
  }

  function chooseCity(city: CityOption) {
    // Submit by id — unambiguous even when two provinces share a city name.
    onSubmit({ cityId: city.id, cityName: city.name })
    reset()
  }

  function submitQuery() {
    if (showList) {
      chooseCity(matches[highlight])
    } else if (query.trim()) {
      // No suggestion open — submit the raw text so exact typing still works.
      onSubmit({ cityName: query.trim() })
      reset()
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
          placeholder={t.acPlaceholder}
          // Intentionally not disabled while a guess is in flight: disabling
          // blurs the input and drops the first keystroke of the next guess.
          role="combobox"
          aria-expanded={showList}
          aria-controls="city-autocomplete-list"
          aria-autocomplete="list"
          autoComplete="off"
        />
        <button type="button" onClick={submitQuery} disabled={disabled || !query.trim()}>
          {t.guessBtn}
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
                  chooseCity(city)
                }}
                onMouseEnter={() => setHighlight(i)}
              >
                <span className="ac-city">{city.name}</span>
                <span className="ac-province">{city.province}</span>
                {already && <span className="ac-guessed-tag">{t.guessedTag}</span>}
              </li>
            )
          })}
        </ul>
      )}
    </div>
  )
}
