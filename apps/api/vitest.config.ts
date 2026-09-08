import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["test/**/*.test.ts"],
    // The services talk to Prisma, which every test replaces with a mock. A
    // real DATABASE_URL must never be read: point it somewhere obviously fake
    // so an unmocked query fails loudly instead of hitting a live database.
    env: { DATABASE_URL: "postgresql://test:test@127.0.0.1:1/maple_test?sslmode=disable" },
    coverage: { provider: "v8", include: ["src/**/*.ts"], exclude: ["src/generated/**"] },
  },
});
