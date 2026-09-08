export interface CityOption {
  id: number
  name: string
  province: string
  aliases: string[]
}

/** Suggestions shown at once. */
export const MAX_RESULTS = 8

// Lowercase + strip accents so "montreal" matches "Montréal" and casing is
// irrelevant. Used for both the query and the candidate names.
export function normalize(s: string): string {
  return s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .trim()
}

// Rank: prefix matches (by whole string, then by any word) above interior
// substring matches. Non-matches are dropped (-1).
export function rank(query: string, name: string): number {
  const q = normalize(query)
  const n = normalize(name)
  if (!q) return -1
  if (n.startsWith(q)) return 0
  if (n.split(/\s+/).some(word => word.startsWith(q))) return 1
  if (n.includes(q)) return 2
  return -1
}

// Best rank across the city's name and its aliases (e.g. "Montreal" matches
// "Montréal"), so a variant spelling still surfaces the canonical city.
export function rankCity(query: string, city: CityOption): number {
  let best = -1
  for (const candidate of [city.name, ...city.aliases]) {
    const score = rank(query, candidate)
    if (score >= 0 && (best === -1 || score < best)) best = score
  }
  return best
}

/**
 * The autocomplete's suggestions for a query.
 *
 * `cities` arrives from the API ordered by population, and the sort below is
 * stable, so within a match tier the more prominent city stays first.
 */
export function matchCities(
  query: string,
  cities: CityOption[],
  limit = MAX_RESULTS,
): CityOption[] {
  if (!query.trim()) return []
  return cities
    .map(city => ({ city, score: rankCity(query, city) }))
    .filter(m => m.score >= 0)
    .sort((a, b) => a.score - b.score)
    .slice(0, limit)
    .map(m => m.city)
}
