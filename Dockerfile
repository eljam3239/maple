# One image serving both the API and the built web app, so the browser talks to
# a single origin and needs no CORS or baked-in API URL.

FROM node:22-slim AS base
RUN corepack enable
WORKDIR /app

# --- Install dependencies against the lockfile only, so this layer is cached
# until a manifest actually changes.
FROM base AS deps
COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --frozen-lockfile

# --- Build the web bundle and generate the Prisma client.
FROM deps AS build
COPY . .
RUN pnpm --filter api exec prisma generate \
 && pnpm --filter web build

# --- Runtime. The API runs from source under tsx, which is what dev uses too,
# so there is no separate build output to keep in step.
#
# Dependencies are installed fresh with --prod rather than copied from the build
# stage: that stage carries the web toolchain, TypeScript and Prisma Studio,
# which together are most of the image and none of which run in production.
FROM base AS runtime
ENV NODE_ENV=production
ENV PORT=8080
# Serve the web bundle from the same process as the API.
ENV WEB_ROOT=/app/apps/web/dist

COPY pnpm-workspace.yaml pnpm-lock.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY apps/web/package.json ./apps/web/
COPY packages/types/package.json ./packages/types/
RUN pnpm install --prod --frozen-lockfile --filter api...  && pnpm store prune

COPY --from=build /app/packages ./packages
COPY --from=build /app/apps/api ./apps/api
COPY --from=build /app/apps/web/dist ./apps/web/dist

WORKDIR /app/apps/api
EXPOSE 8080

# Migrations are NOT run here. They need admin rights the runtime role does not
# have, and every booting machine would race to apply them. Run
# `pnpm --filter api migrate:deploy` before deploying instead; keeping the
# Prisma CLI out of this image also drops Studio, pglite and Effect from it.
CMD ["npx", "tsx", "src/server.ts"]
