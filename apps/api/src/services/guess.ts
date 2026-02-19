import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { distanceKm, getDirection } from "../utils/geo";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export async function evaluateGuess(sessionId: string, cityName: string) {
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

  // 2. Look up the guessed city
  const guessedCity = await prisma.city.findFirst({
    where: {
      name: {
        equals: cityName,
        mode: "insensitive",
      },
    },
  });

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
    distanceKm: distance,
    direction,
    provinceMatch: guessedCity.province === targetCity.province,
    populationHint,
  };
}
