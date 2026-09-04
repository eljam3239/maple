// Guesses allowed per daily puzzle. Reaching this without solving is a loss.
export const MAX_GUESSES = 13;

export interface PlayerStats {
  currentStreak: number;
  maxStreak: number;
  gamesPlayed: number;
  wins: number;
  winPct: number;
  avgGuesses: number;
  lastWin: string | null;
}

// The target city, revealed to the client only once the game is over.
export interface CityRef {
  name: string;
  province: string;
  latitude: number;
  longitude: number;
}

export interface GuessResponse {
  correct: boolean;
  city: string;
  distanceKm: number;
  direction: string;
  provinceMatch: boolean;
  province: string;
  provinceDistance: number;
  populationHint: "larger" | "smaller" | "equal";
  gameOver: boolean;
  won: boolean;
  guessesRemaining: number;
  // Present only once the game is over (solved or out of guesses).
  answer?: CityRef;
  stats?: PlayerStats;
}

