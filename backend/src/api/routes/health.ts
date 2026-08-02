import { Router } from "express";
import { formatEther } from "viem";
import { l1, l2 } from "../../config/chains.js";
import { getPublicClient, getRelayerAccount } from "../../relayer/clients.js";
import { socketGateway } from "../../sockets/gateway.js";
import { prisma } from "../../db/client.js";

const router = Router();

/**
 * GET /api/health
 * Liveness/readiness of the API, the relayer wallet and both chain RPCs.
 * Returns 503 if any critical dependency is unreachable.
 */
router.get("/health", async (_req, res) => {
  async function checkChain(label: string) {
    const config = label === "l1" ? l1 : l2;
    try {
      const client = getPublicClient(config);
      const block = await client.getBlockNumber();
      return { chain: config.label, ok: true, blockNumber: block.toString() };
    } catch (err) {
      return { chain: config.label, ok: false, error: (err as Error).message };
    }
  }

  let dbOk = true;
  let dbError: string | undefined;
  try {
    await prisma.$queryRaw`SELECT 1`;
  } catch (err) {
    dbOk = false;
    dbError = (err as Error).message;
  }

  let relayerOk = false;
  let relayerBalance = "0";
  let relayerAddress: string | undefined;
  let relayerError: string | undefined;
  try {
    const account = getRelayerAccount();
    relayerAddress = account.address;
    const balance = await getPublicClient(l1).getBalance({ address: account.address });
    relayerBalance = formatEther(balance);
    relayerOk = true;
  } catch (err) {
    relayerError = (err as Error).message;
  }

  const [l1Status, l2Status] = await Promise.all([checkChain("l1"), checkChain("l2")]);

  const healthy = dbOk && relayerOk && l1Status.ok && l2Status.ok;

  res.status(healthy ? 200 : 503).json({
    ok: healthy,
    service: "nexbridge-backend",
    version: process.env.npm_package_version ?? "1.0.0",
    uptimeSeconds: Math.floor(process.uptime()),
    database: { ok: dbOk, error: dbError },
    relayer: {
      ok: relayerOk,
      address: relayerAddress,
      balanceEth: relayerBalance,
      error: relayerError,
    },
    chains: { l1: l1Status, l2: l2Status },
    sockets: { connectedClients: socketGateway.connectedClients },
  });
});

export default router;
