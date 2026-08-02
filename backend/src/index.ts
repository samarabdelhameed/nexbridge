import "./config/env.js";
import { createServer } from "node:http";
import express, { type NextFunction, type Request, type Response } from "express";
import helmet from "helmet";
import cors from "cors";

import { logger } from "./utils/logger.js";
import { prisma } from "./db/client.js";
import { socketGateway } from "./sockets/gateway.js";
import { apiRateLimit } from "./api/middleware/rateLimit.js";

import transactionsRouter from "./api/routes/transactions.js";
import statsRouter from "./api/routes/stats.js";
import healthRouter from "./api/routes/health.js";

import { startL1Listener } from "./relayer/listener.l1.js";
import { startL2Listener } from "./relayer/listener.l2.js";
import { logClientHealth } from "./relayer/clients.js";
import { l1, l2 } from "./config/chains.js";

const PORT = Number(process.env.PORT ?? "8080");
const HOST = process.env.HOST ?? "0.0.0.0";

const app = express();
app.disable("x-powered-by");
app.use(helmet());
app.use(
  cors({
    origin: process.env.CORS_ORIGIN ?? "*",
  }),
);
app.use(express.json({ limit: "100kb" }));
app.use(apiRateLimit);

app.use("/api", transactionsRouter);
app.use("/api", statsRouter);
app.use("/api", healthRouter);

app.get("/", (_req, res) => {
  res.json({
    service: "nexbridge-backend",
    endpoints: {
      transactions: "GET /api/transactions/:address",
      transaction: "GET /api/transaction/:txHash",
      stats: "GET /api/stats",
      health: "GET /api/health",
    },
  });
});

// Central error handler
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  logger.error({ err: err.message }, "unhandled api error");
  res.status(500).json({ error: "internal server error" });
});

const httpServer = createServer(app);
socketGateway.attach(httpServer);

const stopL1 = startL1Listener();
const stopL2 = startL2Listener();

if (l1.vaultAddress) logClientHealth(l1);
if (l2.vaultAddress) logClientHealth(l2);

httpServer.listen(PORT, HOST, () => {
  logger.info(`api listening on http://${HOST}:${PORT}`);
});

async function shutdown(signal: string): Promise<void> {
  logger.info({ signal }, "shutting down");
  stopL1();
  stopL2();
  await prisma.$disconnect();
  httpServer.close(() => process.exit(0));
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => void shutdown("SIGINT"));
process.on("SIGTERM", () => void shutdown("SIGTERM"));
