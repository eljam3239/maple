import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Names of guessable cities are not secret — only the daily target is hidden.
// Shipping the full list lets the client offer instant autocomplete without a
// round-trip per keystroke. The `id` lets the client submit an unambiguous
// guess (two provinces can share a city name, e.g. Windsor ON vs NS). Ordered
// by population so the more prominent city ranks first when names tie.
export async function listCities() {
  const cities = await prisma.city.findMany({
    where: { guessable: true },
    select: { id: true, name: true, province: true, aliases: true },
    orderBy: { population: "desc" },
  });

  return cities;
}
