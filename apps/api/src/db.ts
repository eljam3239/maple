import fs from "node:fs";
import { PrismaClient } from "./generated/prisma";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * TLS settings for the database connection.
 *
 * node-postgres defaults SSL *off*, so without this the password and every
 * query cross the public internet in the clear. Supabase presents a cert from
 * its own CA ("Supabase Intermediate 2021 CA"), which Node doesn't trust out of
 * the box — so `sslmode=require` in the URL fails outright with "self-signed
 * certificate in certificate chain".
 *
 * Supply the CA and the connection is encrypted *and* verified. Download it
 * from the Supabase dashboard (Project Settings -> Database -> SSL
 * Configuration) and point PGSSLROOTCERT at the file, or paste the PEM into
 * DATABASE_CA_CERT for hosts that only take environment variables.
 *
 * Without a CA we still negotiate TLS, but cannot verify who we are talking to:
 * that stops passive snooping, not an active man-in-the-middle. It is a
 * stopgap, so it warns.
 *
 * `?sslmode=disable` in DATABASE_URL turns TLS off entirely, for local
 * databases that do not offer it. Never use it against a remote server.
 */
function sslConfig() {
  // Explicit opt-out for databases that don't speak TLS at all — a local
  // Postgres in Docker, say. Without this the pool refuses to connect to them
  // with "The server does not support SSL connections".
  const url = process.env.DATABASE_URL;
  if (url && new URL(url).searchParams.get("sslmode") === "disable") return false;

  const inline = process.env.DATABASE_CA_CERT;
  const certPath = process.env.PGSSLROOTCERT;
  const ca = inline || (certPath ? fs.readFileSync(certPath, "utf8") : undefined);

  if (ca) return { ca, rejectUnauthorized: true };

  console.warn(
    "[db] No DATABASE_CA_CERT or PGSSLROOTCERT set: connecting over TLS but " +
      "NOT verifying the server certificate. Set one before production.",
  );
  return { rejectUnauthorized: false };
}

/**
 * The one Prisma client for the process.
 *
 * Each service used to construct its own, which meant six independent
 * connection pools against the same database — six times the connections, and
 * a fast route to exhausting a hosted Postgres plan's limit.
 *
 * `max` is set explicitly because the default is easy to overrun: the Supabase
 * session-mode pooler holds one server connection per client connection, and
 * the database allows 60 in total. Budget it across however many instances of
 * this process you run.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter: new PrismaPg({
      connectionString: process.env.DATABASE_URL,
      ssl: sslConfig(),
      max: Number(process.env.DATABASE_POOL_MAX ?? 10),
    }),
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
