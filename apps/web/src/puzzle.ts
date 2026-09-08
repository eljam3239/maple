// Reference date for the shareable puzzle number (Maple #N). Day 1 = launch.
export const LAUNCH_EPOCH = Date.UTC(2026, 0, 1)

const DAY_MS = 86_400_000

/**
 * The "Maple #N" number for a puzzle date, as it appears in shared results.
 * Launch day is #1. `puzzleDate` is whatever the API returned — an ISO date or
 * timestamp at UTC midnight.
 */
export function puzzleNumber(puzzleDate: string | null | undefined): number {
  if (!puzzleDate) return 0
  const parsed = Date.parse(puzzleDate)
  if (Number.isNaN(parsed)) return 0
  return Math.floor((parsed - LAUNCH_EPOCH) / DAY_MS) + 1
}
