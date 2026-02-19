import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { getOrCreateDailyPuzzle } from "./puzzle";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export async function createSession() {
  const puzzle = await getOrCreateDailyPuzzle();

  const session = await prisma.gameSession.create({
    data: {
      puzzleDate: puzzle.date,
      targetCityId: puzzle.cityId,
    },
  });

  return {
    sessionId: session.id,
    puzzleDate: session.puzzleDate,
  };
}
