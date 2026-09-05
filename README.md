# Maple 🍁

A daily Canadian city guessing game. One city per day, thirteen guesses, and
after each one you learn the distance, the compass direction, how far the
province is from the target's province, and whether the city is bigger or
smaller. Everyone gets the same city on the same day.

Available in English and French.

## How it works

The answer is never sent to the browser. The client posts a guess to the API,
which looks the target up server-side, returns only the derived hints, and
reveals the city once the game is over (solved, or thirteen guesses spent).

Two pools come out of the same city table:

- **guessable** (~2,750 cities) — anything with 1,000+ residents. Shipped to the
  client for instant autocomplete, so you can guess an obscure hometown and
  still get real distance feedback.
- **answerable** (~174 cities) — the curated, regionally balanced subset that can
  actually be the daily target.

When the game ends, the win screen links out to
[Native Land Digital](https://native-land.ca/) for the territories around the
answer, rather than restating that information here.

## Stack

| | |
|---|---|
| Web | React 19, Vite, react-simple-maps + d3-geo |
| API | Fastify 5, Prisma 7, PostgreSQL |
| Shared | `packages/types` — the request/response contract |
| Tooling | pnpm workspaces, TypeScript |

## Running it locally

Requires Node 22+, pnpm 10+, and a PostgreSQL database.

```bash
pnpm install

# apps/api/.env
echo 'DATABASE_URL="postgresql://user:pass@localhost:5432/maple"' > apps/api/.env

pnpm --filter api generate        # generate the Prisma client
pnpm --filter api exec prisma migrate deploy
pnpm --filter api seed            # load the city data

pnpm dev                          # API on :3000, web on :5173
```

The web dev server proxies `/api/*` to the API, so both need to be running.

`pnpm seed` is destructive — it deletes every guess, session and daily puzzle
and reassigns city ids. It refuses to run against a database that already has
game sessions; `SEED_FORCE=1` overrides that.

### Environment

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | PostgreSQL connection string. Required. |
| `PGSSLROOTCERT` | Path to the database's CA certificate. Without it (or `DATABASE_CA_CERT`) the connection is encrypted but the server's identity is **not verified**, and the API logs a warning at startup. |
| `DATABASE_CA_CERT` | The CA certificate inline as PEM, for hosts that only take env vars. |
| `DATABASE_POOL_MAX` | Connections in the pool (default 10). Budget it against your database's limit and the number of instances you run. |
| `ADMIN_DATABASE_URL` | Connection string with DDL rights, used by migrations and the seed. `DATABASE_URL` is used if unset. |
| `SEED_FORCE` | Set to `1` to let `pnpm seed` run against a database that already has game sessions. |
| `PORT` / `HOST` | Defaults `3000` and `0.0.0.0`. |

On Supabase the CA comes from Project Settings → Database → SSL Configuration.
Its certificate is issued by a private Supabase CA that Node does not trust by
default, so `sslmode=require` in the URL fails; supply the CA instead. For a
local database with no TLS at all, put `?sslmode=disable` in `DATABASE_URL`.

### Least-privilege database role

The API should not connect as the database owner. `pnpm --filter api create-app-role`
creates a `maple_app` role that can read cities and read/insert the rows a round
of play produces — no `DELETE` anywhere, no schema access, no reading the
migration history. It writes the new `DATABASE_URL` into `.env` (and moves the
admin connection to `ADMIN_DATABASE_URL`), generating a password it never
prints.

Re-run it any time to reset the password or re-apply the grants.

### Checking a database is deploy-ready

```bash
pnpm --filter api doctor
```

Reports on TLS (and whether the certificate is actually verified), applied
migrations, seeded rows, connection headroom, and — on Supabase — whether
`anon`/`authenticated` can reach your tables through the Data API. Exits
non-zero if anything fails, so it can gate a deploy.

### Rebuilding the city data

`apps/api/prisma/data/canadian_cities_full.json` is committed, so you only need
this if you want to change the population floor or the answerable pool:

```bash
pnpm --filter api build-cities
```

It downloads the GeoNames Canada dump (cached under `prisma/data/geonames/`,
gitignored) and rewrites the JSON. The tunable knobs are at the top of
[`prisma/build-cities.ts`](apps/api/prisma/build-cities.ts).

## Credits

City data from [GeoNames](https://www.geonames.org/), licensed
[CC BY 4.0](https://creativecommons.org/licenses/by/4.0/).

Indigenous territory information from
[Native Land Digital](https://native-land.ca/). Their map is a work in progress
and is not a definitive or legal source.

The maple leaf is from the
[flag of Canada](https://commons.wikimedia.org/wiki/File:Maple_Leaf.svg)
(public domain).

## License

[MIT](LICENSE) © 2026 Eli James. The GeoNames-derived city data keeps its own
CC BY 4.0 terms.
