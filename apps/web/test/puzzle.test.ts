import { describe, expect, it } from 'vitest'
import { LAUNCH_EPOCH, puzzleNumber } from '../src/puzzle'

describe('puzzleNumber', () => {
  it('numbers launch day as #1', () => {
    expect(puzzleNumber(new Date(LAUNCH_EPOCH).toISOString())).toBe(1)
    expect(puzzleNumber('2026-01-01')).toBe(1)
  })

  it('advances by one each day', () => {
    expect(puzzleNumber('2026-01-02')).toBe(2)
    expect(puzzleNumber('2026-01-31')).toBe(31)
    expect(puzzleNumber('2026-02-01')).toBe(32)
  })

  it('accepts the full timestamp the API returns', () => {
    expect(puzzleNumber('2026-03-10T00:00:00.000Z')).toBe(puzzleNumber('2026-03-10'))
  })

  it('falls back to zero rather than rendering NaN before the date loads', () => {
    expect(puzzleNumber(null)).toBe(0)
    expect(puzzleNumber(undefined)).toBe(0)
    expect(puzzleNumber('')).toBe(0)
    expect(puzzleNumber('not a date')).toBe(0)
  })
})
