import { PrismaClient } from "../generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Names of guessable cities are not secret — only the daily target is hidden.
// Shipping the full list lets the client offer instant autocomplete without a
// round-trip per keystroke. Ordered by population so the more prominent city
// wins when two share a name.
export async function listCities() {
  const cities = await prisma.city.findMany({
    where: { enabled: true },
    select: { name: true, province: true },
    orderBy: { population: "desc" },
  });

  return cities;
}
