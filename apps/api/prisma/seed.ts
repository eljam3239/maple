import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";
import cities from "./data/canadian_cities.json";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function main() {
  for (const city of cities) {
    // Destructure only the fields we need, ignoring any extra fields
    const { name, province, latitude, longitude, population } = city;
    
    await prisma.city.upsert({
      where: {
        name_province: {
          name,
          province,
        },
      },
      update: {}, // we could also update fields if needed, but empty for now
      create: {
        name,
        province,
        latitude,
        longitude,
        population,
      },
    });
  }

  console.log("Cities seeded");
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
