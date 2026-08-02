import { PrismaClient } from "@prisma/client";
import { logger } from "../utils/logger.js";

declare global {
  var __nexbridgePrisma: PrismaClient | undefined;
}

/**
 * Prisma client singleton. In dev, hot reload (tsx watch) re-imports modules,
 * so we cache the client on `globalThis` to avoid exhausting DB connections.
 */
export const prisma: PrismaClient =
  globalThis.__nexbridgePrisma ??
  new PrismaClient({
    log:
      process.env.PRISMA_LOG === "true"
        ? [
            { emit: "event", level: "query" },
            { emit: "event", level: "warn" },
            { emit: "event", level: "error" },
          ]
        : undefined,
  });

if (process.env.PRISMA_LOG === "true") {
  const withLogs = prisma as unknown as {
    $on(level: string, callback: (event: unknown) => void): void;
  };
  withLogs.$on("query", (e) =>
    logger.debug({ target: "prisma", query: (e as { query: string }).query }, "prisma query"),
  );
  withLogs.$on("warn", (e) => logger.warn({ target: "prisma", event: e }, "prisma warn"));
  withLogs.$on("error", (e) => logger.error({ target: "prisma", event: e }, "prisma error"));
}

globalThis.__nexbridgePrisma = prisma;
