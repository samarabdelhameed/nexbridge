import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ChainConfig } from "../src/config/chains.js";

const writeContractMock = vi.fn();
const waitForReceiptMock = vi.fn();

vi.mock("../src/relayer/clients.js", () => ({
  getRelayerWalletClient: () => ({
    writeContract: writeContractMock,
  }),
  getPublicClient: () => ({
    waitForTransactionReceipt: waitForReceiptMock,
  }),
}));

// Speed up the retry/backoff loop so tests finish quickly.
process.env.RELEASE_RETRY_BASE_MS = "1";
process.env.RELEASE_RETRY_BACKOFF = "1";
process.env.RELEASE_MAX_RETRIES = "3";

const { executeRelease } = await import("../src/relayer/release.js");

const destChain = {
  label: "abstract",
  kind: "L2",
  vaultAddress: "0x0000000000000000000000000000000000000001",
  rpcUrl: "http://localhost:8546",
  chain: { id: 11124 },
} as unknown as ChainConfig;

const base = {
  destChain,
  to: "0x0000000000000000000000000000000000000002" as `0x${string}`,
  amount: 1000000000000000000n,
  nonce: 3n,
};

describe("executeRelease", () => {
  beforeEach(() => {
    writeContractMock.mockReset();
    waitForReceiptMock.mockReset();
    waitForReceiptMock.mockResolvedValue({ status: "success", blockNumber: 1n });
  });

  it("returns the tx hash on the first attempt", async () => {
    writeContractMock.mockResolvedValue("0xdead");
    const result = await executeRelease(base);
    expect(result.destTxHash).toBe("0xdead");
    expect(writeContractMock).toHaveBeenCalledTimes(1);
  });

  it("retries with backoff and eventually succeeds", async () => {
    writeContractMock
      .mockRejectedValueOnce(new Error("nonce too low"))
      .mockRejectedValueOnce(new Error("replacement underpriced"))
      .mockResolvedValue("0xbeef");
    const result = await executeRelease(base);
    expect(result.destTxHash).toBe("0xbeef");
    expect(writeContractMock).toHaveBeenCalledTimes(3);
  });

  it("throws after max retries are exhausted", async () => {
    writeContractMock.mockRejectedValue(new Error("boom"));
    await expect(executeRelease(base)).rejects.toThrow(/failed after 3 attempts/);
    expect(writeContractMock).toHaveBeenCalledTimes(3);
  });
});
