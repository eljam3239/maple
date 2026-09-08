import { beforeEach, describe, expect, it, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { WinModal } from '../src/WinModal'
import { LanguageProvider } from '../src/i18n/LanguageContext'
import { dicts } from '../src/i18n/translations'
import type { PlayerStats, ShareGuess } from '../src/share'

const STATS: PlayerStats = {
  currentStreak: 4, maxStreak: 9, gamesPlayed: 12,
  wins: 10, winPct: 83, avgGuesses: 4.2, lastWin: '2026-03-10',
}

const GUESSES: ShareGuess[] = [
  { correct: false, distanceKm: 3000, direction: 'W' },
  { correct: true, distanceKm: 0, direction: 'N' },
]

const PLACE = {
  name: 'Kitchener', province: 'Ontario', latitude: 43.42537, longitude: -80.5112,
}

function setup(overrides: Partial<Parameters<typeof WinModal>[0]> = {}) {
  const onClose = vi.fn()
  render(
    <LanguageProvider>
      <WinModal
        onClose={onClose}
        won
        city="Kitchener"
        place={PLACE}
        guessCount={2}
        puzzleNumber={42}
        stats={STATS}
        guesses={GUESSES}
        {...overrides}
      />
    </LanguageProvider>,
  )
  const user = userEvent.setup()
  // userEvent installs its own clipboard stub on setup, so ours goes on after.
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText }, configurable: true, writable: true,
  })
  return { onClose, user }
}

let writeText: ReturnType<typeof vi.fn>

beforeEach(() => {
  writeText = vi.fn().mockResolvedValue(undefined)
  vi.stubGlobal('isSecureContext', true)
  Object.defineProperty(navigator, 'clipboard', {
    value: { writeText }, configurable: true, writable: true,
  })
})

describe('WinModal', () => {
  it('announces itself as a dialog', () => {
    setup()
    expect(screen.getByRole('dialog')).toHaveAttribute('aria-modal', 'true')
  })

  it('shows the win copy and the streak numbers', () => {
    setup()
    expect(screen.getByRole('heading')).toHaveTextContent(dicts.en.modalTitleWon)
    expect(screen.getByText('83')).toBeInTheDocument()  // win %
    expect(screen.getByText('4.2')).toBeInTheDocument() // average guesses
  })

  it('shows the loss copy when the guesses ran out', () => {
    setup({ won: false })
    expect(screen.getByRole('heading')).toHaveTextContent(dicts.en.modalTitleLost)
  })

  it('links out to Native Land rather than restating the territories', () => {
    setup()
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', expect.stringContaining('native-land.ca'))
    expect(link).toHaveAttribute('rel', expect.stringContaining('noopener'))
  })

  it('omits the territory block before the answer is known', () => {
    setup({ place: null })
    expect(screen.queryByRole('link')).not.toBeInTheDocument()
  })

  it('copies the spoiler-free grid on share', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: dicts.en.share }))

    expect(writeText).toHaveBeenCalledOnce()
    const copied = writeText.mock.calls[0][0] as string
    expect(copied).toContain('Maple #42 🍁 2/13')
    expect(copied).not.toContain('Kitchener')
  })

  it('confirms the copy in the button label', async () => {
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: dicts.en.share }))
    expect(await screen.findByRole('button', { name: dicts.en.copied })).toBeInTheDocument()
  })

  it('does not claim success when the clipboard refuses', async () => {
    writeText.mockRejectedValue(new Error('denied'))
    vi.spyOn(document, 'execCommand').mockReturnValue(false)
    const { user } = setup()
    await user.click(screen.getByRole('button', { name: dicts.en.share }))
    expect(screen.getByRole('button', { name: dicts.en.share })).toBeInTheDocument()
  })

  it('closes on Escape, on the close button, and on a backdrop click', async () => {
    const { onClose, user } = setup()
    await user.keyboard('{Escape}')
    await user.click(screen.getByRole('button', { name: dicts.en.close }))
    expect(onClose).toHaveBeenCalledTimes(2)
  })

  it('does not close when the card itself is clicked', async () => {
    const { onClose, user } = setup()
    await user.click(screen.getByRole('dialog'))
    expect(onClose).not.toHaveBeenCalled()
  })
})
