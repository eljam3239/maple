import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { distanceKm, getDirection } from "../utils/geo";
import { computeProvinceDistance } from "../utils/provinces";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export async function evaluateGuess(
  sessionId: string,
  guess: { cityId?: number; cityName?: string }
) {
  // 1. Look up the session
  const session = await prisma.gameSession.findUnique({
    where: { id: sessionId },
  });

  if (!session) {
    throw new Error("Session not found");
  }

  if (session.completed) {
    throw new Error("Session already completed");
  }

  // 2. Look up the guessed city. The client normally sends an id (picked from
  // the autocomplete), which is unambiguous even when two provinces share a
  // name. A bare name is still accepted as a fallback for free-typed guesses.
  const guessedCity = guess.cityId
    ? await prisma.city.findFirst({ where: { id: guess.cityId, guessable: true } })
    : guess.cityName
    ? await prisma.city.findFirst({
        where: { guessable: true, name: { equals: guess.cityName, mode: "insensitive" } },
      })
    : null;

  if (!guessedCity) {
    throw new Error("City not found");
  }

  // 3. Look up the target city
  const targetCity = await prisma.city.findUnique({
    where: { id: session.targetCityId },
  });

  if (!targetCity) {
    throw new Error("Target city not found");
  }

  // 4. Calculate distance & direction
  const correct = guessedCity.id === targetCity.id;

  const distance = distanceKm(
    guessedCity.latitude,
    guessedCity.longitude,
    targetCity.latitude,
    targetCity.longitude
  );

  const direction = getDirection(
    guessedCity.latitude,
    guessedCity.longitude,
    targetCity.latitude,
    targetCity.longitude
  );

  // 5. Save the guess
  await prisma.guess.create({
    data: {
      sessionId,
      cityId: guessedCity.id,
      distanceKm: distance,
      direction,
      correct,
    },
  });

  // 6. If correct, mark session completed
  if (correct) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { completed: true },
    });
  }

  let populationHint: "larger" | "smaller" | "equal" = "equal";
  if (guessedCity.population < targetCity.population) populationHint = "larger";
  else if (guessedCity.population > targetCity.population) populationHint = "smaller";

  return {
    correct,
    city: guessedCity.name,
    distanceKm: distance,
    direction,
    provinceMatch: guessedCity.province === targetCity.province,
    province: guessedCity.province,
    provinceDistance: computeProvinceDistance(guessedCity.province, targetCity.province),
    populationHint,
    latitude: guessedCity.latitude,
    longitude: guessedCity.longitude,
  };
}
