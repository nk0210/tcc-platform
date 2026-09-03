/**
 * Prisma singleton for apps/api.
 * Imports @prisma/client directly — canonical pattern for the entire API.
 * Never import @tcc/db inside apps/api; that package is for external consumers.
 */
import { PrismaClient } from "@prisma/client";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

const db: PrismaClient =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env["NODE_ENV"] === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env["NODE_ENV"] !== "production") {
  globalForPrisma.prisma = db;
}

export default db;