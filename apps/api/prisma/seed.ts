import "dotenv/config";
import { prisma } from "../src/db";
import cities from "./data/canadian_cities_full.json";

async function main() {
  // This is a destructive rebuild, and it is easy to run against the wrong
  // database. Real play history is unrecoverable, and reseeding reassigns city
  // ids, so surviving rows would point at the wrong cities anyway. Refuse when
  // the database holds sessions unless the caller insists.
  const existingSessions = await prisma.gameSession.count();
  if (existingSessions > 0 && process.env.SEED_FORCE !== "1") {
    console.error(
      `Refusing to seed: this database has ${existingSessions} game session(s).\n` +
        "Seeding deletes every guess, session and daily puzzle, and reassigns city ids.\n" +
        "If you are certain, re-run with SEED_FORCE=1.",
    );
    process.exitCode = 1;
    return;
  }

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
