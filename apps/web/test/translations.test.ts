import { describe, expect, it } from 'vitest'
import { DEFAULT_LANG, LANGUAGES, dicts, type Dict, type Lang } from '../src/i18n/translations'

const langs = Object.keys(dicts) as Lang[]
const keys = (d: Dict) => Object.keys(d).sort()

// English is the reference: every other language must implement it in full,
// with the same shape. A missing key renders as `undefined` in the UI, and a
// string where a function is expected throws on render.
describe('translations', () => {
  it('offers at least English and French', () => {
    expect(langs).toEqual(expect.arrayContaining(['en', 'fr']))
  })

  it.each(langs)('%s covers every key English defines', (lang) => {
    expect(keys(dicts[lang])).toEqual(keys(dicts.en))
  })

  it.each(langs)('%s uses the same value shape as English for every key', (lang) => {
    const shape = (v: unknown) => (Array.isArray(v) ? 'array' : typeof v)
    for (const key of keys(dicts.en)) {
      const k = key as keyof Dict
      expect(shape(dicts[lang][k]), `${lang}.${key}`).toBe(shape(dicts.en[k]))
    }
  })

  it.each(langs)('%s leaves no string blank', (lang) => {
    for (const [key, value] of Object.entries(dicts[lang])) {
      if (typeof value === 'string') {
        expect(value.trim(), `${lang}.${key}`).not.toBe('')
      }
    }
  })

  it.each(langs)('%s lists the same number of how-to steps as English', (lang) => {
    for (const key of keys(dicts.en)) {
      const reference = dicts.en[key as keyof Dict]
      if (Array.isArray(reference)) {
        expect(dicts[lang][key as keyof Dict], `${lang}.${key}`)
          .toHaveLength(reference.length)
      }
    }
  })

  it.each(langs)('%s renders its count-aware strings without throwing', (lang) => {
    for (const [key, value] of Object.entries(dicts[lang])) {
      if (typeof value === 'function') {
        // The interpolated values are all counts in practice.
        expect(() => (value as (...a: number[]) => unknown)(3, 13), `${lang}.${key}`).not.toThrow()
      }
    }
  })

  it('gives the picker exactly one entry per language, with no duplicates', () => {
    expect(LANGUAGES.map(l => l.code).sort()).toEqual([...langs].sort())
    expect(new Set(LANGUAGES.map(l => l.label)).size).toBe(LANGUAGES.length)
  })

  it('has a default language that actually exists', () => {
    expect(dicts[DEFAULT_LANG]).toBeDefined()
  })
})
