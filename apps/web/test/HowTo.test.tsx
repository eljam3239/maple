import { describe, expect, it } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MAX_GUESSES } from '@maple/types'
import { HowTo } from '../src/HowTo'
import { LanguageProvider } from '../src/i18n/LanguageContext'
import { dicts } from '../src/i18n/translations'

const t = dicts.en

function setup() {
  render(
    <LanguageProvider>
      <div>
        <HowTo />
        <button>outside</button>
      </div>
    </LanguageProvider>,
  )
  return {
    user: userEvent.setup(),
    trigger: screen.getByRole('button', { name: t.howToLabel }),
  }
}

describe('HowTo', () => {
  it('stays closed until asked for', () => {
    const { trigger } = setup()
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
    expect(trigger).toHaveAttribute('aria-expanded', 'false')
  })

  it('lists every rule when opened', async () => {
    const { user, trigger } = setup()
    await user.click(trigger)

    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getAllByRole('listitem')).toHaveLength(t.howToSteps(MAX_GUESSES).length)
  })

  it('credits GeoNames, as CC BY 4.0 requires of the shipped app', async () => {
    const { user, trigger } = setup()
    await user.click(trigger)

    const link = screen.getByRole('link', { name: 'GeoNames' })
    expect(link).toHaveAttribute('href', 'https://www.geonames.org/')
    expect(screen.getByText(/CC BY 4.0/)).toBeInTheDocument()
  })

  it('toggles shut on a second click', async () => {
    const { user, trigger } = setup()
    await user.click(trigger)
    await user.click(trigger)
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on Escape', async () => {
    const { user, trigger } = setup()
    await user.click(trigger)
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('closes on a click elsewhere on the page', async () => {
    const { user, trigger } = setup()
    await user.click(trigger)
    await user.click(screen.getByRole('button', { name: 'outside' }))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('stays open when the panel itself is clicked', async () => {
    const { user, trigger } = setup()
    await user.click(trigger)
    await user.click(screen.getByRole('heading', { name: t.howToTitle }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
})
