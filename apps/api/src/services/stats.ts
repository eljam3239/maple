import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export interface PlayerStats {
  currentStreak: number;
  maxStreak: number;
  gamesPlayed: number;
  wins: number;
  winPct: number;
  avgGuesses: number; // average guesses across won games (1 decimal)
  lastWin: string | null; // yyyy-mm-dd of the most recent win
}

const DAY_MS = 86_400_000;
const dayKey = (ms: number) => new Date(ms).toISOString().slice(0, 10); // UTC yyyy-mm-dd

function todayUTC(): number {
  const now = new Date();
  return Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
}

// Streak/win stats for a player, derived from their per-day sessions. A puzzle
// is one-per-UTC-day, so a won session's puzzleDate is the unit of streak.
export async function computeStats(playerId: string): Promise<PlayerStats> {
  const sessions = await prisma.gameSession.findMany({
    where: { playerId },
    select: {
      puzzleDate: true,
      completed: true,
      guesses: { select: { correct: true } },
    },
  });

  // A game counts once it's finished (won or lost). A win is a finished game
  // that has a correct guess — losses (13 guesses, no hit) don't count.
  const finished = sessions.filter((s) => s.completed);
  const wonSessions = finished.filter((s) => s.guesses.some((g) => g.correct));
  const gamesPlayed = finished.length;
  const wins = wonSessions.length;
  const winPct = gamesPlayed ? Math.round((wins / gamesPlayed) * 100) : 0;

  const totalWinningGuesses = wonSessions.reduce((sum, s) => sum + s.guesses.length, 0);
  const avgGuesses = wins ? Math.round((totalWinningGuesses / wins) * 10) / 10 : 0;

  const wonDays = new Set(wonSessions.map((s) => dayKey(s.puzzleDate.getTime())));
  const sortedWonDays = [...wonDays].sort();
  const lastWin = sortedWonDays.length ? sortedWonDays[sortedWonDays.length - 1] : null;

  // Current streak: walk back from today over won days. If today isn't won yet
  // the streak is still alive from yesterday, so start there.
  let currentStreak = 0;
  let cursor = todayUTC();
  if (!wonDays.has(dayKey(cursor))) cursor -= DAY_MS;
  while (wonDays.has(dayKey(cursor))) {
    currentStreak++;
    cursor -= DAY_MS;
  }

  // Longest run of consecutive won days, ever.
  let maxStreak = 0;
  let run = 0;
  let prev: number | null = null;
  for (const key of sortedWonDays) {
    const ms = Date.parse(`${key}T00:00:00Z`);
    run = prev !== null && ms - prev === DAY_MS ? run + 1 : 1;
    if (run > maxStreak) maxStreak = run;
    prev = ms;
  }

  return { currentStreak, maxStreak, gamesPlayed, wins, winPct, avgGuesses, lastWin };
}
