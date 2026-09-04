import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { distanceKm, getDirection } from "../utils/geo";
import { computeProvinceDistance } from "../utils/provinces";
import { computeStats } from "./stats";
import { MAX_GUESSES } from "@maple/types";
import { GameError } from "../errors";

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
    throw new GameError("SESSION_NOT_FOUND", "Session not found");
  }

  if (session.completed) {
    throw new GameError("SESSION_COMPLETED", "Session already completed");
  }

  // Enforce the per-puzzle guess cap. Reaching MAX_GUESSES ends the game as a
  // loss (handled below), so a further guess should never arrive — but guard
  // anyway in case a client submits past the limit.
  const priorGuesses = await prisma.guess.count({ where: { sessionId } });
  if (priorGuesses >= MAX_GUESSES) {
    throw new GameError("NO_GUESSES_REMAINING", "No guesses remaining");
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
    throw new GameError("CITY_NOT_FOUND", "City not found");
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

  // 6. Resolve end-of-game. The game is over when solved, or when this guess
  // exhausts the MAX_GUESSES budget (a loss).
  const guessesUsed = priorGuesses + 1;
  const guessesRemaining = MAX_GUESSES - guessesUsed;
  const gameOver = correct || guessesRemaining <= 0;

  let stats = undefined;
  if (gameOver) {
    await prisma.gameSession.update({
      where: { id: sessionId },
      data: { completed: true },
    });
    stats = await computeStats(session.playerId);
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
    gameOver,
    won: correct,
    guessesRemaining,
    // Reveal the target only once the game is over.
    answer: gameOver
      ? {
          name: targetCity.name,
          province: targetCity.province,
          latitude: targetCity.latitude,
          longitude: targetCity.longitude,
        }
      : undefined,
    stats,
  };
}
