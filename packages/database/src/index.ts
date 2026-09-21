import { PrismaClient } from "@prisma/client";

declare global {
  // eslint-disable-next-line no-var
  var __contenthubPrisma: PrismaClient | undefined;
}

/**
 * Singleton Prisma client. Reused across hot reloads in dev (Next.js/tsx)
 * so we don't exhaust the Postgres connection pool.
 */
export const prisma =
  globalThis.__contenthubPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__contenthubPrisma = prisma;
}

export * from "@prisma/client";
