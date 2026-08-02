import {
  watchContractEvent,
  getTransactionReceipt,
  getBlockNumber,
} from "viem/actions";
import { formatUnits } from "viem/utils";
import type { Address, Log } from "viem";
import type { ChainConfig } from "../config/chains.js";
import { directionFor, counterChain } from "../config/chains.js";
import { vaultAbi } from "../abi/vault.js";
import { prisma } from "../db/client.js";
import { nonceManager } from "./nonceManager.js";
import { getPublicClient } from "./clients.js";
import { executeRelease } from "./release.js";
import { socketGateway } from "../sockets/gateway.js";
import { logger } from "../utils/logger.js";

const CONFIRMATION_POLL_MS = Number(process.env.CONFIRMATION_POLL_MS ?? "2000");
const CONFIRMATION_TIMEOUT_MS = Number(
  process.env.CONFIRMATION_TIMEOUT_MS ?? String(15 * 60 * 1000),
);

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Block until `receipt.blockNumber` has at least `confirmations` blocks on top.
 * Times out after CONFIRMATION_TIMEOUT_MS.
 */
async function waitForConfirmations(
  chain: ChainConfig,
  txHash: `0x${string}`,
  confirmations: number,
): Promise<void> {
  if (confirmations <= 0) return;

  const client = getPublicClient(chain);
  const receipt = await getTransactionReceipt(client, { hash: txHash });
  const target = receipt.blockNumber + BigInt(confirmations);

  const deadline = Date.now() + CONFIRMATION_TIMEOUT_MS;
  while (Date.now() < deadline) {
    const head = await getBlockNumber(client);
    if (head >= target) return;
    logger.debug(
      { chain: chain.label, txHash, head: head.toString(), target: target.toString() },
      "waiting for confirmations",
    );
    await sleep(CONFIRMATION_POLL_MS);
  }
  throw new Error(`timeout waiting for ${confirmations} confirmations on ${chain.label}`);
}

interface ParsedDeposit {
  user: Address;
  amount: bigint;
  nonce: bigint;
}

function parseDeposit(log: Log): ParsedDeposit | null {
  if (!("args" in log && log.args)) return null;
  const { user, amount, nonce } = log.args as unknown as {
    user: Address;
    amount: bigint;
    nonce: bigint;
  };
  if (!user || amount == null || nonce == null) return null;
  return { user, amount, nonce };
}

async function emitStatus(txHash: string): Promise<void> {
  const tx = await prisma.bridgeTransaction.findUnique({ where: { sourceTxHash: txHash } });
  if (tx) socketGateway.emitUpdate({ ...tx, amount: tx.amount.toString() });
}

/**
 * Full relayer pipeline for a single deposit:
 *   PENDING (observed) -> CONFIRMED (N confirmations) -> RELEASING ->
 *   RELEASED (release tx mined)  |  FAILED (on any error, with retries).
 */
export async function handleDeposit(
  sourceChain: ChainConfig,
  log: Log,
): Promise<void> {
  const sourceTxHash = log.transactionHash as `0x${string}`;

  if (!nonceManager.tryAcquire(sourceTxHash)) {
    logger.debug({ sourceTxHash }, "skipping duplicate deposit event");
    return;
  }

  try {
    const deposit = parseDeposit(log);
    if (!deposit) {
      logger.warn({ sourceTxHash }, "could not parse deposit log");
      return;
    }

    const existing = await prisma.bridgeTransaction.findUnique({
      where: { sourceTxHash },
    });
    if (existing && (existing.status === "RELEASED" || existing.status === "RELEASING")) {
      logger.info({ sourceTxHash, status: existing.status }, "deposit already finalised");
      return;
    }

    const amount = deposit.amount;
    const record = await prisma.bridgeTransaction.upsert({
      where: { sourceTxHash },
      create: {
        userAddress: deposit.user.toLowerCase(),
        direction: directionFor(sourceChain),
        amount: amount.toString(),
        amountHuman: formatUnits(amount, 18),
        sourceChain: sourceChain.label,
        destChain: counterChain(sourceChain).label,
        sourceTxHash,
        nonce: deposit.nonce.toString(),
        status: "PENDING",
      },
      update: existing ? { status: "PENDING" } : {},
    });
    await emitStatus(sourceTxHash);

    // Step 2: confirmations
    await waitForConfirmations(sourceChain, sourceTxHash, sourceChain.confirmations);
    await prisma.bridgeTransaction.update({
      where: { id: record.id },
      data: { status: "CONFIRMED" },
    });
    logger.info({ sourceTxHash, user: deposit.user, amount: formatUnits(deposit.amount, 18) }, "deposit confirmed");
    await emitStatus(sourceTxHash);

    // Step 3: release on the destination chain
    await prisma.bridgeTransaction.update({
      where: { id: record.id },
      data: { status: "RELEASING" },
    });
    await emitStatus(sourceTxHash);

    const { destTxHash, nonce } = await executeRelease({
      destChain: counterChain(sourceChain),
      to: deposit.user,
      amount: deposit.amount,
      nonce: deposit.nonce,
    });

    await prisma.bridgeTransaction.update({
      where: { id: record.id },
      data: { status: "RELEASED", destTxHash, nonce },
    });
    logger.info({ sourceTxHash, destTxHash, nonce }, "bridge transfer complete");
    await emitStatus(sourceTxHash);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    logger.error({ sourceTxHash, err: message }, "bridge transfer failed");
    await prisma.bridgeTransaction.updateMany({
      where: { sourceTxHash },
      data: {
        status: "FAILED",
        errorMessage: message,
        attempts: { increment: 1 },
      },
    });
    await emitStatus(sourceTxHash);
  } finally {
    nonceManager.release(sourceTxHash);
  }
}

/**
 * Start listening for Deposited events on a chain. Uses the WebSocket transport
 * when configured, otherwise falls back to HTTP polling (also what anvil uses).
 */
export function startChainListener(chain: ChainConfig): () => void {
  if (!chain.vaultAddress) {
    logger.warn({ chain: chain.label }, "no vault address configured — skipping listener");
    return () => {};
  }

  const client = getPublicClient(chain);
  logger.info(
    { chain: chain.label, vault: chain.vaultAddress },
    "starting deposit listener",
  );

  // Poll for new Deposited logs. When a WebSocket RPC is configured the poller
  // runs over the WebSocket connection; otherwise it falls back to HTTP.
  const unwatch = watchContractEvent(client, {
    address: chain.vaultAddress,
    abi: vaultAbi,
    eventName: "Deposited",
    poll: true,
    pollingInterval: Number(process.env.POLL_INTERVAL_MS ?? "2000"),
    onLogs: (logs) => {
      for (const log of logs) {
        void handleDeposit(chain, log);
      }
    },
    onError: (err) => logger.error({ chain: chain.label, err: err.message }, "listener error"),
  });

  return () => {
    logger.info({ chain: chain.label }, "stopping listener");
    unwatch();
  };
}
