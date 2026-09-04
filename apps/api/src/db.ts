import { PrismaClient } from "./generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * The one Prisma client for the process.
 *
 * Each service used to construct its own, which meant six independent
 * connection pools against the same database — six times the connections, and
 * a fast route to exhausting a hosted Postgres plan's limit.
 *
 * The globalThis cache keeps a dev server that reloads modules from stacking up
 * a new pool on every reload. In production the module is evaluated once, so
 * the cache is skipped.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
