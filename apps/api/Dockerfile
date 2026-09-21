# Builds the ContentHub API from the pnpm workspace root context.
# Build with:  docker build -f apps/api/Dockerfile -t contenthub-api .
#
# Workspace packages (packages/*) ship TypeScript source directly
# (package.json "main" points at src/index.ts) rather than a compiled
# dist/ — there's no per-package build step yet. Running the API through
# tsx in production (instead of `tsc` + `node dist/`) means it can resolve
# those TS sources directly; typechecking still happens in CI via
# `pnpm typecheck`. Splitting packages into their own build steps is a
# natural next hardening step, not required for the app to run correctly.
FROM node:20-alpine AS base
# Prisma's query engine is a separate native binary that dynamically links
# against the system libssl — node:20-alpine doesn't install the `openssl`
# apk package by default, so without this the engine can't find libssl.so.3
# at runtime even with the correct binaryTarget set in schema.prisma.
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @contenthub/database generate

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=deps /repo /repo
EXPOSE 4000
# Applies pending migrations, then starts the API — safe to run on every
# container start since prisma migrate deploy is idempotent.
CMD ["sh", "-c", "pnpm --filter @contenthub/database migrate:deploy && pnpm --filter @contenthub/api exec tsx src/index.ts"]
