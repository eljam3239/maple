import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

function getTodayUTC(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export async function getOrCreateDailyPuzzle() {
  const today = getTodayUTC();

  let puzzle = await prisma.dailyPuzzle.findUnique({
    where: { date: today },
    include: { city: true },
  });

  if (puzzle) return puzzle;

  // select random enabled city
  const cities = await prisma.city.findMany({
    where: { enabled: true },
  });

  if (cities.length === 0) {
    throw new Error("No cities available");
  }

  const randomCity = cities[Math.floor(Math.random() * cities.length)];

  puzzle = await prisma.dailyPuzzle.create({
    data: {
      date: today,
      cityId: randomCity.id,
    },
    include: { city: true },
  });

  return puzzle;
}
