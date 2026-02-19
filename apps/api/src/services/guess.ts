import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import { distanceKm, getDirection } from "../utils/geo";
import { getOrCreateDailyPuzzle } from "./puzzle";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

export async function evaluateGuess(guessName: string) {
  const puzzle = await getOrCreateDailyPuzzle();

  const guess = await prisma.city.findFirst({
    where: {
      name: {
        equals: guessName,
        mode: "insensitive",
      },
    },
  });

  if (!guess) {
    throw new Error("City not found");
  }

  const answer = puzzle.city;

  const correct = guess.id === answer.id;

  const distance = distanceKm(
    guess.latitude,
    guess.longitude,
    answer.latitude,
    answer.longitude
  );

  const direction = getDirection(
    guess.latitude,
    guess.longitude,
    answer.latitude,
    answer.longitude
  );

  let populationHint: "larger" | "smaller" | "equal" = "equal";

  if (guess.population < answer.population) populationHint = "larger";
  else if (guess.population > answer.population) populationHint = "smaller";

  return {
    correct,
    distanceKm: distance,
    direction,
    provinceMatch: guess.province === answer.province,
    populationHint,
  };
}
