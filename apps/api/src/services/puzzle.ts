import { prisma } from "../db";

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

  // select a random answerable city (the curated daily-target pool)
  const cities = await prisma.city.findMany({
    where: { answerable: true },
  });

  if (cities.length === 0) {
    throw new Error("No cities available");
  }

  const randomCity = cities[Math.floor(Math.random() * cities.length)];

  // At UTC midnight several players can arrive at once, all miss the lookup
  // above, and all try to insert the same primary key. Exactly one wins; the
  // losers read back the winner's puzzle rather than failing, so nobody gets an
  // error and everyone gets the same city.
  try {
    return await prisma.dailyPuzzle.create({
      data: {
        date: today,
        cityId: randomCity.id,
      },
      include: { city: true },
    });
  } catch (err) {
    if ((err as { code?: string }).code !== "P2002") throw err;

    const winner = await prisma.dailyPuzzle.findUnique({
      where: { date: today },
      include: { city: true },
    });
    if (!winner) throw err;
    return winner;
  }
}
