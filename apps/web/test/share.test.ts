import { describe, expect, it } from 'vitest'
import { MAX_GUESSES } from '@maple/types'
import {
  buildShareText, directionEmoji, nativeLandUrl, proximityEmoji,
  type PlayerStats, type ShareGuess,
} from '../src/share'

const guess = (o: Partial<ShareGuess> = {}): ShareGuess =>
  ({ correct: false, distanceKm: 1000, direction: 'N', ...o })

const STATS: PlayerStats = {
  currentStreak: 4, maxStreak: 9, gamesPlayed: 12,
  wins: 10, winPct: 83, avgGuesses: 4.2, lastWin: '2026-03-10',
}

describe('proximityEmoji', () => {
  it('reserves green for the answer', () => {
    expect(proximityEmoji(guess({ correct: true, distanceKm: 0 }))).toBe('🟩')
  })

  it('buckets a miss by distance', () => {
    expect(proximityEmoji(guess({ distanceKm: 0 }))).toBe('🟨')
    expect(proximityEmoji(guess({ distanceKm: 400 }))).toBe('🟧')
    expect(proximityEmoji(guess({ distanceKm: 3000 }))).toBe('🟥')
  })

  it('puts each threshold in the warmer bucket', () => {
    expect(proximityEmoji(guess({ distanceKm: 150 }))).toBe('🟨')
    expect(proximityEmoji(guess({ distanceKm: 151 }))).toBe('🟧')
    expect(proximityEmoji(guess({ distanceKm: 750 }))).toBe('🟧')
    expect(proximityEmoji(guess({ distanceKm: 751 }))).toBe('🟥')
  })
})

describe('directionEmoji', () => {
  it('shows a target for the winning guess instead of an arrow', () => {
    expect(directionEmoji(guess({ correct: true, direction: 'N' }))).toBe('🎯')
  })

  it('maps all eight compass points to an arrow', () => {
    const arrows = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW']
      .map(direction => directionEmoji(guess({ direction })))
    expect(new Set(arrows).size).toBe(8)
    expect(arrows).not.toContain('⬛')
  })

  it('degrades to a blank square on an unrecognised direction', () => {
    expect(directionEmoji(guess({ direction: 'NNE' }))).toBe('⬛')
  })
})

describe('buildShareText', () => {
  it('scores a win as guesses-used out of the maximum', () => {
    const text = buildShareText(42, true, [guess(), guess({ correct: true })], null)
    expect(text.split('\n')[0]).toBe(`Maple #42 🍁 2/${MAX_GUESSES}`)
  })

  it('scores a loss as X', () => {
    const text = buildShareText(42, false, [guess()], null)
    expect(text.split('\n')[0]).toBe(`Maple #42 🍁 X/${MAX_GUESSES}`)
  })

  it('adds the streak line when stats are known', () => {
    const text = buildShareText(42, true, [guess({ correct: true })], STATS)
    expect(text).toContain('🔥 4 | Avg. Guesses: 4.2')
  })

  it('omits the streak line when they are not', () => {
    expect(buildShareText(42, true, [guess({ correct: true })], null)).not.toContain('🔥')
  })

  it('draws one grid row per guess, in order', () => {
    const text = buildShareText(1, true, [
      guess({ distanceKm: 3000, direction: 'W' }),
      guess({ distanceKm: 400, direction: 'NE' }),
      guess({ correct: true, distanceKm: 0 }),
    ], null)
    const rows = text.split('\n').filter(l => /^[🟩🟨🟧🟥]/u.test(l))
    expect(rows).toEqual(['🟥⬅️', '🟧↗️', '🟩🎯'])
  })

  it('lays the result out as header, streak, grid, hashtag', () => {
    const text = buildShareText(42, true, [
      guess({ distanceKm: 400, direction: 'NE' }),
      guess({ correct: true, distanceKm: 0 }),
    ], STATS)
    expect(text.split('\n')).toEqual([
      `Maple #42 \u{1F341} 2/${MAX_GUESSES}`,
      '\u{1F525} 4 | Avg. Guesses: 4.2',
      '\u{1F7E7}\u2197\uFE0F',
      '\u{1F7E9}\u{1F3AF}',
      '#maple',
    ])
  })

  it('still produces a valid share for a game with no guesses', () => {
    expect(() => buildShareText(1, false, [], null)).not.toThrow()
  })
})

describe('nativeLandUrl', () => {
  const KITCHENER = {
    name: 'Kitchener', province: 'Ontario', latitude: 43.42537, longitude: -80.5112,
  }

  it('passes the centre as longitude,latitude — the order their map expects', () => {
    expect(nativeLandUrl(KITCHENER)).toContain('center=-80.5112,43.42537')
  })

  it('leaves the commas in the place name literal, matching their own share links', () => {
    expect(nativeLandUrl(KITCHENER)).toContain('placename=Kitchener,%20Ontario,%20Canada')
  })

  it('escapes everything else, accents included', () => {
    const url = nativeLandUrl({
      name: 'Trois-Rivières', province: 'Quebec', latitude: 46.35, longitude: -72.55,
    })
    expect(url).toContain('Trois-Rivi%C3%A8res,%20Quebec,%20Canada')
    expect(() => new URL(url)).not.toThrow()
  })

  it('points at native-land.ca', () => {
    expect(new URL(nativeLandUrl(KITCHENER)).origin).toBe('https://native-land.ca')
  })
})
