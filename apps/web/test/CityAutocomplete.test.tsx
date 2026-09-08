import { describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CityAutocomplete } from '../src/CityAutocomplete'
import { LanguageProvider } from '../src/i18n/LanguageContext'
import type { CityOption } from '../src/search'

const CITIES: CityOption[] = [
  { id: 1, name: 'Toronto', province: 'Ontario', aliases: [] },
  { id: 2, name: 'Montréal', province: 'Quebec', aliases: ['Montreal'] },
  { id: 3, name: 'Thunder Bay', province: 'Ontario', aliases: [] },
  { id: 4, name: 'Timmins', province: 'Ontario', aliases: [] },
  { id: 5, name: 'Windsor', province: 'Ontario', aliases: [] },
  { id: 6, name: 'Windsor', province: 'Nova Scotia', aliases: [] },
]

function setup(opts: { guessed?: string[]; disabled?: boolean } = {}) {
  const onSubmit = vi.fn()
  render(
    <LanguageProvider>
      <CityAutocomplete
        cities={CITIES}
        guessedNames={new Set(opts.guessed ?? [])}
        disabled={opts.disabled}
        onSubmit={onSubmit}
      />
    </LanguageProvider>,
  )
  return { onSubmit, user: userEvent.setup(), input: screen.getByRole('combobox') }
}

const options = () => screen.queryAllByRole('option')

describe('CityAutocomplete', () => {
  it('shows no dropdown until something is typed', () => {
    setup()
    expect(options()).toHaveLength(0)
    expect(screen.getByRole('combobox')).toHaveAttribute('aria-expanded', 'false')
  })

  it('suggests matching cities as you type', async () => {
    const { user, input } = setup()
    await user.type(input, 'th')
    expect(screen.getByText('Thunder Bay')).toBeInTheDocument()
    expect(input).toHaveAttribute('aria-expanded', 'true')
  })

  it('finds an accented city typed without accents', async () => {
    const { user, input } = setup()
    await user.type(input, 'montreal')
    expect(screen.getByText('Montréal')).toBeInTheDocument()
  })

  it('shows the province, so two cities of the same name can be told apart', async () => {
    const { user, input } = setup()
    await user.type(input, 'windsor')
    const provinces = options().map(o => o.textContent)
    expect(provinces.some(t => t?.includes('Ontario'))).toBe(true)
    expect(provinces.some(t => t?.includes('Nova Scotia'))).toBe(true)
  })

  it('submits the highlighted city by id, not by name', async () => {
    const { user, input, onSubmit } = setup()
    await user.type(input, 'toron{Enter}')
    expect(onSubmit).toHaveBeenCalledWith({ cityId: 1, cityName: 'Toronto' })
  })

  it('submits by id when a suggestion is clicked', async () => {
    const { user, input, onSubmit } = setup()
    await user.type(input, 'windsor')
    await user.click(screen.getAllByRole('option')[1])
    expect(onSubmit).toHaveBeenCalledWith({ cityId: 6, cityName: 'Windsor' })
  })

  it('moves the highlight with the arrow keys', async () => {
    const { user, input, onSubmit } = setup()
    await user.type(input, 'windsor')
    await user.keyboard('{ArrowDown}{Enter}')
    expect(onSubmit).toHaveBeenCalledWith({ cityId: 6, cityName: 'Windsor' })

    await user.type(input, 'windsor')
    await user.keyboard('{ArrowDown}{ArrowUp}{Enter}')
    expect(onSubmit).toHaveBeenLastCalledWith({ cityId: 5, cityName: 'Windsor' })
  })

  it('does not walk the highlight off either end of the list', async () => {
    const { user, input, onSubmit } = setup()
    await user.type(input, 'toron')
    await user.keyboard('{ArrowUp}{ArrowUp}{ArrowDown}{ArrowDown}{ArrowDown}{Enter}')
    expect(onSubmit).toHaveBeenCalledWith({ cityId: 1, cityName: 'Toronto' })
  })

  it('submits raw text when the dropdown has been dismissed', async () => {
    const { user, input, onSubmit } = setup()
    await user.type(input, 'Toronto')
    await user.keyboard('{Escape}')
    expect(options()).toHaveLength(0)
    await user.keyboard('{Enter}')
    expect(onSubmit).toHaveBeenCalledWith({ cityName: 'Toronto' })
  })

  it('trims a raw-text guess', async () => {
    const { user, input, onSubmit } = setup()
    await user.type(input, '  Narnia  ')
    await user.keyboard('{Escape}{Enter}')
    expect(onSubmit).toHaveBeenCalledWith({ cityName: 'Narnia' })
  })

  it('clears the box after a guess so the next one starts fresh', async () => {
    const { user, input } = setup()
    await user.type(input, 'toron{Enter}')
    expect(input).toHaveValue('')
    expect(options()).toHaveLength(0)
  })

  it('flags a city that has already been guessed', async () => {
    const { user, input } = setup({ guessed: ['toronto'] })
    await user.type(input, 'toron')
    expect(screen.getByRole('option')).toHaveClass('guessed')
  })

  it('matches the guessed flag past accents, so a city is not offered twice', async () => {
    const { user, input } = setup({ guessed: ['montreal'] })
    await user.type(input, 'montr')
    expect(screen.getByRole('option')).toHaveClass('guessed')
  })

  it('will not submit an empty box', async () => {
    const { user, onSubmit } = setup()
    const button = screen.getByRole('button')
    expect(button).toBeDisabled()
    await user.keyboard('{Enter}')
    expect(onSubmit).not.toHaveBeenCalled()
  })

  it('disables the button while a guess is in flight, but keeps the input typable', async () => {
    const { user, input } = setup({ disabled: true })
    await user.type(input, 'toron')
    // Disabling the input would blur it and swallow the next keystroke.
    expect(input).toBeEnabled()
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('closes the dropdown on a click outside the widget', async () => {
    const { user, input } = setup()
    await user.type(input, 'toron')
    expect(options()).toHaveLength(1)
    await user.click(document.body)
    expect(options()).toHaveLength(0)
  })
})
