import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { getOrCreateDailyPuzzle } from "./puzzle";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export async function createPlayer() {
  const player = await prisma.player.create({ data: {} });
  return { playerId: player.id };
}

export async function getOrCreateSession(playerId: string) {
  // Ensure the player exists; if not, create one with the given id
  const player = await prisma.player.findUnique({ where: { id: playerId } });
  if (!player) {
    await prisma.player.create({ data: { id: playerId } });
  }

  const puzzle = await getOrCreateDailyPuzzle();
  const today = puzzle.date;

  // Check for existing session for this player + today
  const existing = await prisma.gameSession.findUnique({
    where: {
      playerId_puzzleDate: {
        playerId,
        puzzleDate: today,
      },
    },
    include: {
      guesses: {
        include: { city: true },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  if (existing) {
    // Look up target city to enrich guess data
    const targetCity = await prisma.city.findUnique({
      where: { id: existing.targetCityId },
    });

    return {
      sessionId: existing.id,
      puzzleDate: existing.puzzleDate,
      completed: existing.completed,
      guesses: existing.guesses.map((g) => {
        let populationHint: "larger" | "smaller" | "equal" = "equal";
        if (targetCity) {
          if (g.city.population < targetCity.population) populationHint = "larger";
          else if (g.city.population > targetCity.population) populationHint = "smaller";
        }
        return {
          city: g.city.name,
          correct: g.correct,
          distanceKm: g.distanceKm,
          direction: g.direction,
          provinceMatch: targetCity ? g.city.province === targetCity.province : false,
          populationHint,
        };
      }),
    };
  }

  // Create new session
  const session = await prisma.gameSession.create({
    data: {
      playerId,
      puzzleDate: today,
      targetCityId: puzzle.cityId,
    },
  });

  return {
    sessionId: session.id,
    puzzleDate: session.puzzleDate,
    completed: false,
    guesses: [],
  };
}
