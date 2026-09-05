/**
 * Creates (or updates) the least-privilege role the API runs as.
 *
 * The API was connecting as `postgres`, which owns every table and holds
 * BYPASSRLS — so a leaked DATABASE_URL meant total control of the database.
 * This role can only do what the game actually does: read cities, and
 * read/insert the rows a round of play produces. It cannot DELETE anything,
 * cannot touch _prisma_migrations, and cannot alter schema.
 *
 * Migrations and the seed still need the admin role, so they read
 * ADMIN_DATABASE_URL (falling back to DATABASE_URL).
 *
 * Run: pnpm --filter api create-app-role
 *
 * The generated password is written straight into apps/api/.env and never
 * printed, so it cannot leak through a terminal transcript.
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { Client } from "pg";

const ROLE = "maple_app";

// What the running API is allowed to do, derived from the Prisma calls in
// src/services. Deliberately no DELETE: nothing in the game deletes rows.
const GRANTS: Record<string, string> = {
  City: "SELECT",
  DailyPuzzle: "SELECT, INSERT",
  Player: "SELECT, INSERT",
  GameSession: "SELECT, INSERT, UPDATE",
  Guess: "SELECT, INSERT",
};

function sslConfig() {
  const url = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
  if (url && new URL(url).searchParams.get("sslmode") === "disable") return false;
  const ca =
    process.env.DATABASE_CA_CERT ||
    (process.env.PGSSLROOTCERT ? fs.readFileSync(process.env.PGSSLROOTCERT, "utf8") : undefined);
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

async function main() {
  const adminUrl = process.env.ADMIN_DATABASE_URL || process.env.DATABASE_URL;
  if (!adminUrl) throw new Error("Set ADMIN_DATABASE_URL or DATABASE_URL");

  const password = crypto.randomBytes(24).toString("base64url");
  const c = new Client({ connectionString: adminUrl, ssl: sslConfig() });
  await c.connect();

  const dbName = (await c.query("select current_database() d")).rows[0].d;
  const exists = (await c.query("select 1 from pg_roles where rolname = $1", [ROLE])).rowCount;

  await c.query(
    exists
      ? `ALTER ROLE ${ROLE} WITH LOGIN PASSWORD ${lit(password)}`
      : `CREATE ROLE ${ROLE} WITH LOGIN PASSWORD ${lit(password)}`,
  );
  console.log(`  ${exists ? "updated" : "created"} role ${ROLE}`);

  await c.query(`GRANT CONNECT ON DATABASE ${ident(dbName)} TO ${ROLE}`);
  await c.query(`GRANT USAGE ON SCHEMA public TO ${ROLE}`);

  // Start from nothing, so re-running tightens rather than accumulates.
  await c.query(`REVOKE ALL ON ALL TABLES IN SCHEMA public FROM ${ROLE}`);

  for (const [table, privs] of Object.entries(GRANTS)) {
    await c.query(`GRANT ${privs} ON TABLE ${ident(table)} TO ${ROLE}`);
    // RLS is enabled on these tables with no policies, which denies every role
    // that cannot bypass it — including this one. Only a superuser can grant
    // BYPASSRLS, and Supabase's postgres is not one, so the role needs an
    // explicit policy. The GRANT above is what actually limits the verbs; this
    // policy just stops RLS blocking the role outright.
    await c.query(`DROP POLICY IF EXISTS ${ident(`${ROLE}_all`)} ON ${ident(table)}`);
    await c.query(
      `CREATE POLICY ${ident(`${ROLE}_all`)} ON ${ident(table)} FOR ALL TO ${ROLE} USING (true) WITH CHECK (true)`,
    );
    console.log(`  ${table.padEnd(12)} ${privs}`);
  }

  await c.end();

  // Build the app's URL from the admin one, swapping in the new credentials.
  // Supavisor expects <role>.<project-ref> as the username; a direct connection
  // expects the bare role name.
  const u = new URL(adminUrl);
  const ref = u.username.includes(".") ? u.username.split(".").slice(1).join(".") : null;
  u.username = ref ? `${ROLE}.${ref}` : ROLE;
  u.password = password;

  writeEnv("DATABASE_URL", u.toString());
  writeEnv("ADMIN_DATABASE_URL", adminUrl);
  console.log(`\n  .env updated: DATABASE_URL now uses ${ROLE}, ADMIN_DATABASE_URL keeps the admin role.`);
  console.log("  The password was written to .env and deliberately not printed.");
}

function lit(s: string) {
  return `'${s.replace(/'/g, "''")}'`;
}
function ident(s: string) {
  return `"${s.replace(/"/g, '""')}"`;
}

function writeEnv(key: string, value: string) {
  const p = path.join(__dirname, "..", ".env");
  let s = fs.existsSync(p) ? fs.readFileSync(p, "utf8") : "";
  const line = `${key}="${value}"`;
  const re = new RegExp(`^${key}=.*$`, "m");
  s = re.test(s) ? s.replace(re, line) : s.replace(/\n*$/, "\n") + line + "\n";
  fs.writeFileSync(p, s);
}

main().catch((e) => {
  console.error("failed:", e.message);
  process.exit(1);
});
