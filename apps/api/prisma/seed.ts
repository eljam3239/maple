import "dotenv/config";
import { prisma } from "../src/db";
import cities from "./data/canadian_cities_full.json";

async function main() {
  // Full rebuild: canonical names changed (e.g. "Montreal" -> "Montréal"), so a
  // plain upsert would leave stale rows behind. Cities are recreated with fresh
  // auto-increment ids, so we must also clear every row that references a city
  // id — including GameSession.targetCityId, or existing sessions would point at
  // deleted cities ("Target city not found"). FK-safe order; wipes play history,
  // which is fine while we're reshaping the city data.
  await prisma.guess.deleteMany();
  await prisma.gameSession.deleteMany();
  await prisma.dailyPuzzle.deleteMany();
  await prisma.city.deleteMany();

  const result = await prisma.city.createMany({
    data: cities.map((c) => ({
      name: c.name,
      province: c.province,
      latitude: c.latitude,
      longitude: c.longitude,
      population: c.population,
      guessable: c.guessable,
      answerable: c.answerable,
      aliases: c.aliases,
    })),
    skipDuplicates: true,
  });

  const answerable = cities.filter((c) => c.answerable).length;
  console.log(`Cities seeded: ${result.count} guessable, ${answerable} answerable`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
