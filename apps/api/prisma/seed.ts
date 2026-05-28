import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import cities from "./data/canadian_cities_150.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const city of cities) {
    const { name, province, latitude, longitude, population } = city;

    await prisma.city.upsert({
      where: {
        name_province: {
          name,
          province,
        },
      },
      update: {
        latitude,
        longitude,
        population,
        enabled: true,
      },
      create: {
        name,
        province,
        latitude,
        longitude,
        population,
        enabled: true,
      },
    });
  }

  console.log(`Cities seeded: ${cities.length}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
