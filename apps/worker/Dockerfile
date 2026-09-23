# Builds the ContentHub view-events worker from the pnpm workspace root context.
# Build with:  docker build -f apps/worker/Dockerfile -t contenthub-worker .
#
# Consumes the BullMQ "content-view-events" queue (docs/REVENUE.md #36):
# Browser -> API collector -> Queue -> Worker (this) -> ContentView aggregate.
# Same tsx-in-production approach as apps/api/Dockerfile — see its comment
# for why (workspace packages ship TS source, no per-package build step yet).
FROM node:20-alpine AS base
# Prisma's query engine needs libssl at runtime — see apps/api/Dockerfile.
RUN apk add --no-cache openssl
RUN corepack enable
WORKDIR /repo

FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/worker ./apps/worker
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @contenthub/database generate

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=deps /repo /repo
CMD ["pnpm", "--filter", "@contenthub/worker", "exec", "tsx", "src/index.ts"]
