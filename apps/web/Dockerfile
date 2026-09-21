# Builds the ContentHub web app from the pnpm workspace root context.
# Build with:  docker build -f apps/web/Dockerfile -t contenthub-web .
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
COPY apps/web ./apps/web
RUN pnpm install --frozen-lockfile

FROM deps AS build
ARG SITE_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ENV SITE_URL=${SITE_URL} \
    NEXT_PUBLIC_SITE_URL=${NEXT_PUBLIC_SITE_URL} \
    NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL}
RUN pnpm --filter @contenthub/database generate
RUN pnpm --filter @contenthub/web build

FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo /repo
EXPOSE 3000
CMD ["pnpm", "--filter", "@contenthub/web", "start"]
