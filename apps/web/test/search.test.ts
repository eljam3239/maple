import { describe, expect, it } from 'vitest'
import { MAX_RESULTS, matchCities, normalize, rank, rankCity, type CityOption } from '../src/search'

let nextId = 1
const city = (name: string, province = 'Ontario', aliases: string[] = []): CityOption => ({
  id: nextId++, name, province, aliases,
})

// As the API ships them: ordered by population, descending.
const CITIES = [
  city('Toronto'),
  city('Montréal', 'Quebec', ['Montreal']),
  city('Québec', 'Quebec', ['Quebec City', 'Quebec']),
  city('Thunder Bay'),
  city('North Bay'),
  city('Bayfield'),
  city('Timmins'),
  city('Trois-Rivières', 'Quebec', ['Trois-Rivieres']),
]

const names = (query: string, cities = CITIES) => matchCities(query, cities).map(c => c.name)

describe('normalize', () => {
  it('strips accents so a plain-ASCII query still matches', () => {
    expect(normalize('Montréal')).toBe('montreal')
    expect(normalize('Québec')).toBe('quebec')
    expect(normalize('Trois-Rivières')).toBe('trois-rivieres')
  })

  it('folds case and trims surrounding space', () => {
    expect(normalize('  TORONTO  ')).toBe('toronto')
  })
})

describe('rank', () => {
  it('puts a whole-string prefix first, then a word prefix, then a substring', () => {
    expect(rank('thu', 'Thunder Bay')).toBe(0)
    expect(rank('bay', 'Thunder Bay')).toBe(1)
    expect(rank('unde', 'Thunder Bay')).toBe(2)
  })

  it('rejects a non-match', () => {
    expect(rank('xyz', 'Thunder Bay')).toBe(-1)
  })

  it('rejects an empty query rather than matching everything', () => {
    expect(rank('', 'Toronto')).toBe(-1)
    expect(rank('   ', 'Toronto')).toBe(-1)
  })
})

describe('rankCity', () => {
  it('takes the best score across the name and its aliases', () => {
    const quebec = CITIES.find(c => c.name === 'Québec')!
    // "quebec city" is a prefix of the alias but not of the name.
    expect(rankCity('quebec c', quebec)).toBe(0)
  })

  it('returns no match when neither the name nor an alias matches', () => {
    expect(rankCity('narnia', CITIES[0])).toBe(-1)
  })
})

describe('matchCities', () => {
  it('suggests nothing for an empty query', () => {
    expect(matchCities('', CITIES)).toEqual([])
    expect(matchCities('   ', CITIES)).toEqual([])
  })

  it('finds an accented city from an unaccented query', () => {
    expect(names('montreal')).toContain('Montréal')
    expect(names('trois-rivieres')).toContain('Trois-Rivières')
  })

  it('finds an accented city from the accented spelling too', () => {
    expect(names('Montré')).toContain('Montréal')
  })

  it('ignores case', () => {
    expect(names('TORONTO')).toEqual(['Toronto'])
  })

  it('ranks a name prefix above a word prefix', () => {
    // "Bayfield" starts with the query; the other two only have a word that does.
    expect(names('bay')).toEqual(['Bayfield', 'Thunder Bay', 'North Bay'])
  })

  it('ranks a word prefix above an interior substring', () => {
    // "Forest" is a word prefix in Mount Forest; "for" sits mid-word in
    // Stratford. The word prefix wins despite coming second in the input.
    const list = [city('Stratford'), city('Mount Forest')]
    expect(matchCities('for', list).map(c => c.name)).toEqual(['Mount Forest', 'Stratford'])
  })

  it('keeps population order within a tier, since the API sends them sorted', () => {
    // All three start with "t" — same tier, so nothing separates them but the
    // order they arrived in.
    const tier = [city('Toronto'), city('Thunder Bay'), city('Timmins')]
    expect(matchCities('t', tier).map(c => c.name)).toEqual([
      'Toronto', 'Thunder Bay', 'Timmins',
    ])
  })

  it('drops cities that do not match at all', () => {
    expect(names('zzz')).toEqual([])
  })

  it('caps the list so the dropdown stays usable', () => {
    const many = Array.from({ length: 40 }, (_, i) => city(`Springfield ${i}`))
    expect(matchCities('spring', many)).toHaveLength(MAX_RESULTS)
    expect(matchCities('spring', many, 3)).toHaveLength(3)
  })

  it('matches an interior substring so a half-remembered name still resolves', () => {
    expect(names('ronto')).toEqual(['Toronto'])
  })

  it('does not return the same city twice when several aliases match', () => {
    // Québec carries both "Quebec City" and "Quebec" as aliases.
    expect(names('quebec')).toEqual(['Québec'])
  })
})
