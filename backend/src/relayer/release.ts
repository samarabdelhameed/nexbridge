import { formatUnits, type Address } from "viem";
import type { ChainConfig } from "../config/chains.js";
import { vaultAbi } from "../abi/vault.js";
import { getPublicClient, getRelayerWalletClient } from "./clients.js";
import { logger } from "../utils/logger.js";

export interface ReleaseInput {
  destChain: ChainConfig;
  to: Address;
  amount: bigint;
  nonce: bigint;
}

export interface ReleaseResult {
  destTxHash: `0x${string}`;
  nonce: string;
}

const MAX_RETRIES = Number(process.env.RELEASE_MAX_RETRIES ?? "3");
const RETRY_BASE_MS = Number(process.env.RELEASE_RETRY_BASE_MS ?? "2000");
const RETRY_BACKOFF = Number(process.env.RELEASE_RETRY_BACKOFF ?? "2");

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function errorMessage(err: unknown): string {
  const short = (err as { shortMessage?: string }).shortMessage;
  return short ?? (err instanceof Error ? err.message : String(err));
}

/**
 * Submit release() on the destination chain using the relayer wallet, wait for
 * the transaction to be mined and confirmed, with exponential backoff retries.
 * Returns the destination tx hash on success.
 */
export async function executeRelease(input: ReleaseInput): Promise<ReleaseResult> {
  const { destChain, to, amount, nonce } = input;
  const walletClient = getRelayerWalletClient(destChain);
  const publicClient = getPublicClient(destChain);

  let delay = RETRY_BASE_MS;
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      logger.info(
        { chain: destChain.label, to, amount: formatUnits(amount, 18), nonce: nonce.toString(), attempt },
        "submitting release()",
      );
      const hash = await walletClient.writeContract({
        address: destChain.vaultAddress,
        abi: vaultAbi,
        functionName: "release",
        args: [to, amount, nonce],
      });
      logger.info({ chain: destChain.label, hash }, "release() tx submitted, waiting for receipt");
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      if (receipt.status !== "success") {
        throw new Error(`release() tx ${hash} reverted on chain`);
      }
      logger.info({ chain: destChain.label, hash, block: receipt.blockNumber }, "release() tx mined");
      return { destTxHash: hash, nonce: nonce.toString() };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      logger.warn(
        { chain: destChain.label, attempt, err: errorMessage(err) },
        "release() attempt failed",
      );
      if (attempt < MAX_RETRIES) {
        await sleep(delay);
        delay *= RETRY_BACKOFF;
      }
    }
  }

  throw new Error(`release() failed after ${MAX_RETRIES} attempts: ${errorMessage(lastError)}`);
}
