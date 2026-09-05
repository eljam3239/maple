/**
 * Checks that the database in DATABASE_URL is fit to deploy against.
 *
 * Written for the Supabase migration, but it is provider-agnostic: it asks the
 * server what is actually true rather than trusting the connection string.
 * Exits non-zero if anything FAILs, so it can gate a deploy.
 *
 * Run: pnpm --filter api doctor
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { Client } from "pg";

type Level = "PASS" | "WARN" | "FAIL";
const results: { level: Level; label: string; detail: string }[] = [];
const add = (level: Level, label: string, detail: string) => results.push({ level, label, detail });

const EXPECTED_TABLES = ["City", "DailyPuzzle", "GameSession", "Guess", "Player"];

// Mirrors src/db.ts, so the doctor tests the same connection the API makes.
function sslConfig() {
  const url = process.env.DATABASE_URL;
  if (url && new URL(url).searchParams.get("sslmode") === "disable") return false;
  const ca = process.env.DATABASE_CA_CERT || (process.env.PGSSLROOTCERT ? fs.readFileSync(process.env.PGSSLROOTCERT, "utf8") : undefined);
  return ca ? { ca, rejectUnauthorized: true } : { rejectUnauthorized: false };
}

async function main() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL is not set.");
    process.exit(1);
  }

  const host = new URL(url).hostname;
  const region = host.match(/aws-\d+-([a-z]{2}-[a-z]+-\d)/)?.[1];
  add(region ? "PASS" : "WARN", "Region", region ? `${region} (from ${host})` : `could not infer from ${host}`);

  const client = new Client({ connectionString: url, ssl: sslConfig() });
  await client.connect();

  // --- Transport security. Read the socket, not pg_stat_ssl: behind a pooler
  // that reports the pooler-to-database hop, not ours.
  const sock: any = (client as any).connection?.stream;
  if (!sock?.encrypted) {
    const local = /^(localhost|127\.|::1|host\.docker\.internal)/.test(host);
    add(local ? "WARN" : "FAIL", "TLS", local ? "not encrypted (local database)" : "connection is NOT encrypted");
  } else if (sock.authorized) {
    add("PASS", "TLS", `${sock.getProtocol()}, certificate verified`);
  } else {
    add("WARN", "TLS", `${sock.getProtocol()} but certificate NOT verified (${sock.authorizationError}). Set PGSSLROOTCERT or DATABASE_CA_CERT.`);
  }

  const q = async (sql: string) => (await client.query(sql)).rows;

  const [{ version, tz, usr, bypass }] = await q(
    `select current_setting('server_version') version, current_setting('TimeZone') tz,
            current_user usr, (select rolbypassrls from pg_roles where rolname=current_user) bypass`) as any;
  add("PASS", "Server", `PostgreSQL ${version}`);
  const utc = tz === "UTC" || tz === "Etc/UTC";
  add(utc ? "PASS" : "WARN", "Timezone", utc ? `${tz} (matches getTodayUTC)` : `${tz} — puzzle rollover uses UTC, expected UTC`);
  add(bypass ? "WARN" : "PASS", "DB role", bypass ? `${usr} has BYPASSRLS — consider a least-privilege role for the API` : `${usr}`);

  // --- Schema and migrations
  // The least-privilege runtime role cannot read _prisma_migrations, by design.
  // Use the admin connection for this check when one is configured, and never
  // mistake "permission denied" for "nothing applied".
  const dir = path.join(__dirname, "..", "prisma", "migrations");
  const onDisk = fs.existsSync(dir) ? fs.readdirSync(dir).filter((d) => fs.statSync(path.join(dir, d)).isDirectory()) : [];
  const migrationSql = `select migration_name from _prisma_migrations where finished_at is not null`;

  let applied: any[] | null = null;
  const adminUrl = process.env.ADMIN_DATABASE_URL;
  if (adminUrl && adminUrl !== url) {
    const admin = new Client({ connectionString: adminUrl, ssl: sslConfig() });
    try {
      await admin.connect();
      applied = (await admin.query(migrationSql)).rows;
    } catch {
      applied = null;
    } finally {
      await admin.end().catch(() => {});
    }
  } else {
    applied = await q(migrationSql).catch(() => null);
  }

  if (applied === null) {
    add("WARN", "Migrations", `cannot read _prisma_migrations as this role — set ADMIN_DATABASE_URL to verify (${onDisk.length} on disk)`);
  } else {
    const missing = onDisk.filter((m) => !applied!.some((a: any) => a.migration_name === m));
    add(missing.length ? "FAIL" : "PASS", "Migrations",
      missing.length ? `${missing.length} not applied: ${missing.join(", ")} — run prisma migrate deploy` : `all ${onDisk.length} applied`);
  }

  const tables = (await q(`select relname from pg_class where relnamespace='public'::regnamespace and relkind='r'`)).map((r: any) => r.relname);
  const missingTables = EXPECTED_TABLES.filter((t) => !tables.includes(t));
  add(missingTables.length ? "FAIL" : "PASS", "Tables", missingTables.length ? `missing ${missingTables.join(", ")}` : `all ${EXPECTED_TABLES.length} present`);

  // --- Seed data
  if (!missingTables.includes("City")) {
    const [{ total, answerable }] = await q(`select count(*) total, count(*) filter (where answerable) answerable from "City"`) as any;
    const expected = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "prisma", "data", "canadian_cities_full.json"), "utf8")).length;
    add(Number(total) === expected ? "PASS" : Number(total) === 0 ? "FAIL" : "WARN", "Cities",
      `${total} rows (${answerable} answerable); seed file has ${expected}`);
  }

  // --- Supabase Data API exposure. Tables are only reachable over PostgREST if
  // anon/authenticated hold grants, so check grants, not just RLS.
  const grants = await q(`select table_name, grantee from information_schema.role_table_grants
                          where table_schema='public' and grantee in ('anon','authenticated')`);
  const rls = await q(`select relname, relrowsecurity from pg_class
                       where relnamespace='public'::regnamespace and relkind='r'`);
  const unprotected = rls.filter((r: any) => !r.relrowsecurity).map((r: any) => r.relname);
  if (grants.length) {
    add("FAIL", "Data API", `anon/authenticated can reach ${[...new Set(grants.map((g: any) => g.table_name))].join(", ")} — revoke, or enable RLS`);
  } else {
    add("PASS", "Data API", `no anon/authenticated grants on public${unprotected.length ? ` (RLS off on ${unprotected.length} tables, but unreachable without grants)` : ""}`);
  }

  // --- Capacity
  const [{ used, max }] = await q(`select (select count(*) from pg_stat_activity) used, (select setting::int from pg_settings where name='max_connections') max`) as any;
  const poolMax = Number(process.env.DATABASE_POOL_MAX ?? 10);
  add(poolMax < Number(max) ? "PASS" : "WARN", "Connections", `${used}/${max} in use; this process pools up to ${poolMax}`);

  await client.end();

  // --- Report
  const pad = Math.max(...results.map((r) => r.label.length));
  console.log();
  for (const r of results) {
    const mark = r.level === "PASS" ? "PASS" : r.level === "WARN" ? "WARN" : "FAIL";
    console.log(`  ${mark}  ${r.label.padEnd(pad)}  ${r.detail}`);
  }
  const fails = results.filter((r) => r.level === "FAIL").length;
  const warns = results.filter((r) => r.level === "WARN").length;
  console.log(`\n  ${fails} failed, ${warns} warnings, ${results.length - fails - warns} passed\n`);
  process.exit(fails ? 1 : 0);
}

main().catch((e) => {
  console.error("doctor failed to run:", e.message);
  process.exit(1);
});
