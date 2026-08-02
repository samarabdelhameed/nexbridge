/**
 * End-to-end integration test for the NexBridge relayer backend.
 *
 * Spins up two local anvil chains (L1 + L2), deploys L1Vault/L2Vault, seeds
 * liquidity, starts the real backend, then performs real deposits in both
 * directions and asserts the relayer releases funds on the destination chain.
 *
 * Requirements: `anvil` on PATH, node_modules installed (`npm install`).
 * Run: `npm run test:integration`
 */
import { spawn, spawnSync, type ChildProcess } from "node:child_process";
import { mkdtempSync, readFileSync, existsSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import {
  createPublicClient,
  createWalletClient,
  defineChain,
  http,
  type Address,
} from "viem";
import { privateKeyToAccount } from "viem/accounts";
import { sepolia } from "viem/chains";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BACKEND_DIR = join(__dirname, "..");

const L1_PORT = 8545;
const L2_PORT = 8546;
const API_PORT = 8081;
const L1_CHAIN_ID = 11155111;
const L2_CHAIN_ID = 11124;

const DEPLOYER_KEY =
  "0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80"; // anvil #0
const RELAYER_KEY =
  "0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d"; // anvil #1
const USER_KEY =
  "0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a"; // anvil #5

const DEPLOYER = privateKeyToAccount(DEPLOYER_KEY as `0x${string}`).address;
const RELAYER = privateKeyToAccount(RELAYER_KEY as `0x${string}`).address;
const USER = privateKeyToAccount(USER_KEY as `0x${string}`).address;

const l1Chain = defineChain({
  ...sepolia,
  id: L1_CHAIN_ID,
  rpcUrls: { default: { http: [`http://127.0.0.1:${L1_PORT}`] } },
});
const l2Chain = defineChain({
  id: L2_CHAIN_ID,
  name: "Abstract Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [`http://127.0.0.1:${L2_PORT}`] } },
});

const l1Public = createPublicClient({ chain: l1Chain, transport: http() });
const l2Public = createPublicClient({ chain: l2Chain, transport: http() });
const l1Wallet = createWalletClient({ chain: l1Chain, transport: http(), account: DEPLOYER });
const l2Wallet = createWalletClient({ chain: l2Chain, transport: http(), account: DEPLOYER });
const userWallet = createWalletClient({ chain: l1Chain, transport: http(), account: USER });

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function waitFor(fn: () => Promise<boolean>, what: string, timeoutMs = 60_000) {
  const deadline = Date.now() + timeoutMs;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      if (await fn()) return;
    } catch (err) {
      lastErr = err;
    }
    await sleep(500);
  }
  throw new Error(`timeout waiting for ${what}${lastErr ? `: ${(lastErr as Error).message}` : ""}`);
}

const children: ChildProcess[] = [];
function spawnAnvil(port: number, chainId: number): ChildProcess {
  const child = spawn(
    "anvil",
    ["--port", String(port), "--chain-id", String(chainId), "--silent", "--block-time", "1"],
    { detached: true },
  );
  children.push(child);
  child.stdout?.on("data", () => {});
  child.stderr?.on("data", (d: Buffer) => process.stderr.write(`[anvil:${port}] ${d}`));
  return child;
}

async function readBytecode(contractName: string): Promise<`0x${string}`> {
  const artifactPath = join(BACKEND_DIR, "..", "contracts", "out", `${contractName}.sol`, `${contractName}.json`);
  if (!existsSync(artifactPath)) {
    throw new Error(`contract artifact not found at ${artifactPath}. Run \`forge build\` first.`);
  }
  const artifact = JSON.parse(readFileSync(artifactPath, "utf8")) as {
    bytecode?: string | { object?: string };
  };
  const bytecode =
    typeof artifact.bytecode === "string"
      ? artifact.bytecode
      : artifact.bytecode?.object;
  if (!bytecode) throw new Error(`no bytecode in ${artifactPath}`);
  return bytecode as `0x${string}`;
}

async function deployVault(
  wallet: ReturnType<typeof createWalletClient>,
  chainId: number,
  chain: ReturnType<typeof defineChain>,
  owner: Address,
): Promise<Address> {
  const bytecode = await readBytecode(chainId === L1_CHAIN_ID ? "L1Vault" : "L2Vault");
  const hash = await wallet.deployContract({
    chain,
    bytecode,
    account: DEPLOYER,
    abi: [
      { type: "constructor", inputs: [{ name: "owner_", type: "address" }], stateMutability: "nonpayable" },
      {
        type: "function",
        name: "setRelayer",
        inputs: [{ name: "newRelayer", type: "address" }],
        outputs: [],
        stateMutability: "nonpayable",
      },
      {
        type: "function",
        name: "release",
        inputs: [
          { name: "to", type: "address" },
          { name: "amount", type: "uint256" },
          { name: "nonce", type: "uint256" },
        ],
        outputs: [],
        stateMutability: "nonpayable",
      },
      {
        type: "function",
        name: "deposit",
        inputs: [],
        outputs: [{ name: "nonce", type: "uint256" }],
        stateMutability: "payable",
      },
      { type: "function", name: "userNonces", inputs: [{ name: "user", type: "address" }], outputs: [{ name: "", type: "uint256" }], stateMutability: "view" },
    ],
    args: [owner],
  });
  const publicClient = chainId === L1_CHAIN_ID ? l1Public : l2Public;
  const receipt = await publicClient.waitForTransactionReceipt({ hash });
  if (!receipt.contractAddress) throw new Error("deploy failed: no contract address");
  return receipt.contractAddress;
}

async function fetchJson(path: string): Promise<Record<string, unknown>> {
  const res = await fetch(`http://127.0.0.1:${API_PORT}${path}`);
  return (await res.json()) as Record<string, unknown>;
}

async function main(): Promise<void> {
  const workdir = mkdtempSync(join(tmpdir(), "nexbridge-integration-"));
  const dbPath = join(workdir, "dev.db");
  let backend: ChildProcess | null = null;
  let l1Vault: Address | null = null;
  let l2Vault: Address | null = null;

  console.log("=== NexBridge integration test ===");
  console.log("Spawning anvil chains...");
  spawnAnvil(L1_PORT, L1_CHAIN_ID);
  spawnAnvil(L2_PORT, L2_CHAIN_ID);

  await waitFor(async () => (await l1Public.getBlockNumber()) > 0n, "anvil L1");
  await waitFor(async () => (await l2Public.getBlockNumber()) > 0n, "anvil L2");

  console.log("Deploying L1Vault + L2Vault...");
  l1Vault = await deployVault(l1Wallet, L1_CHAIN_ID, l1Chain, DEPLOYER);
  l2Vault = await deployVault(l2Wallet, L2_CHAIN_ID, l2Chain, DEPLOYER);
  console.log(`  L1Vault: ${l1Vault}`);
  console.log(`  L2Vault: ${l2Vault}`);

  console.log("Configuring relayers and seeding L2 liquidity...");
  await l1Wallet.writeContract({
    address: l1Vault,
    abi: [
      { type: "function", name: "setRelayer", inputs: [{ name: "newRelayer", type: "address" }], outputs: [], stateMutability: "nonpayable" },
    ],
    functionName: "setRelayer",
    args: [RELAYER],
  });
  await l2Wallet.writeContract({
    address: l2Vault,
    abi: [
      { type: "function", name: "setRelayer", inputs: [{ name: "newRelayer", type: "address" }], outputs: [], stateMutability: "nonpayable" },
    ],
    functionName: "setRelayer",
    args: [RELAYER],
  });
  await l2Wallet.sendTransaction({ to: l2Vault, value: 10n * 10n ** 18n });

  console.log("Preparing SQLite database...");
  const push = spawnSync(
    "npx",
    ["prisma", "db", "push", "--schema", "prisma/schema.prisma"],
    {
      cwd: BACKEND_DIR,
      env: { ...process.env, DATABASE_URL: `file:${dbPath}` },
      encoding: "utf8",
    },
  );
  if (push.status !== 0) {
    console.error(push.stdout);
    console.error(push.stderr);
    throw new Error("prisma db push failed");
  }

  console.log("Starting backend...");
  backend = spawn(
    "npx",
    ["tsx", "src/index.ts"],
    {
      cwd: BACKEND_DIR,
      detached: true,
      env: {
        ...process.env,
        PORT: String(API_PORT),
        HOST: "127.0.0.1",
        LOG_LEVEL: "info",
        DATABASE_URL: `file:${dbPath}`,
        RELAYER_PRIVATE_KEY: RELAYER_KEY,
        L1_RPC_URL: `http://127.0.0.1:${L1_PORT}`,
        L1_WS_URL: "",
        L1_VAULT_ADDRESS: l1Vault,
        L1_CHAIN_ID: String(L1_CHAIN_ID),
        L1_CONFIRMATIONS: "0",
        L2_RPC_URL: `http://127.0.0.1:${L2_PORT}`,
        L2_WS_URL: "",
        L2_VAULT_ADDRESS: l2Vault,
        L2_CHAIN_ID: String(L2_CHAIN_ID),
        L2_CONFIRMATIONS: "0",
        PRISMA_LOG: "false",
      } as NodeJS.ProcessEnv,
    },
  );
  children.push(backend);
  backend.stdout?.on("data", (d: Buffer) => process.stdout.write(`[backend] ${d}`));
  backend.stderr?.on("data", (d: Buffer) => process.stderr.write(`[backend:err] ${d}`));

  await waitFor(async () => {
    const health = (await fetchJson("/api/health")) as { ok?: boolean };
    return health.ok === true;
  }, "backend healthy", 120_000);

  // --- L1 -> L2 ---
  console.log("\n--- L1 -> L2 deposit ---");
  const l2BalanceBefore = await l2Public.getBalance({ address: USER });
  const depositAmount = 2n * 10n ** 18n;
  const depositHash = await userWallet.writeContract({
    address: l1Vault!,
    abi: [
      { type: "function", name: "deposit", inputs: [], outputs: [{ name: "nonce", type: "uint256" }], stateMutability: "payable" },
    ],
    functionName: "deposit",
    value: depositAmount,
  });
  console.log(`  deposit tx: ${depositHash}`);

  await waitFor(async () => {
    const data = (await fetchJson(`/api/transactions/${USER}`)) as {
      items?: Array<{ sourceTxHash: string; status: string; destTxHash?: string | null }>;
    };
    const tx = data.items?.find((t) => t.sourceTxHash.toLowerCase() === depositHash.toLowerCase());
    return tx?.status === "RELEASED" && Boolean(tx.destTxHash);
  }, "L1->L2 transfer RELEASED", 120_000);

  const tx = (
    (await fetchJson(`/api/transactions/${USER}`)) as {
      items: Array<{ sourceTxHash: string; status: string; destTxHash: string }>;
    }
  ).items.find((t) => t.sourceTxHash.toLowerCase() === depositHash.toLowerCase())!;

  await waitFor(
    async () => (await l2Public.getBalance({ address: USER })) === l2BalanceBefore + depositAmount,
    "user balance credited on L2",
  );
  const l2BalanceAfter = await l2Public.getBalance({ address: USER });
  console.log(`  status=${tx.status} destTxHash=${tx.destTxHash}`);
  console.log(`  L2 balance: ${l2BalanceBefore} -> ${l2BalanceAfter} (+${l2BalanceAfter - l2BalanceBefore})`);

  if (l2BalanceAfter !== l2BalanceBefore + depositAmount) {
    throw new Error("L1->L2 release amount mismatch");
  }

  // --- L2 -> L1 ---
  console.log("\n--- L2 -> L1 deposit ---");
  const userWalletL2 = createWalletClient({ chain: l2Chain, transport: http(), account: USER });
  const l1BalanceBefore = await l1Public.getBalance({ address: USER });
  const backHash = await userWalletL2.writeContract({
    address: l2Vault!,
    abi: [
      { type: "function", name: "deposit", inputs: [], outputs: [{ name: "nonce", type: "uint256" }], stateMutability: "payable" },
    ],
    functionName: "deposit",
    value: depositAmount,
  });
  console.log(`  deposit tx: ${backHash}`);

  await waitFor(async () => {
    const data = (await fetchJson(`/api/transactions/${USER}`)) as {
      items?: Array<{ sourceTxHash: string; status: string; destTxHash?: string | null }>;
    };
    const item = data.items?.find((t) => t.sourceTxHash.toLowerCase() === backHash.toLowerCase());
    return item?.status === "RELEASED" && Boolean(item.destTxHash);
  }, "L2->L1 transfer RELEASED", 120_000);

  await waitFor(
    async () => (await l1Public.getBalance({ address: USER })) === l1BalanceBefore + depositAmount,
    "user balance credited on L1",
  );
  const l1BalanceAfter = await l1Public.getBalance({ address: USER });
  console.log(`  L1 balance: ${l1BalanceBefore} -> ${l1BalanceAfter} (+${l1BalanceAfter - l1BalanceBefore})`);

  if (l1BalanceAfter !== l1BalanceBefore + depositAmount) {
    throw new Error("L2->L1 release amount mismatch");
  }

  // --- Stats ---
  const stats = (await fetchJson("/api/stats")) as { totalTransactions?: number; totalVolumeWei?: string };
  console.log("\n--- Stats ---");
  console.log(`  totalTransactions=${stats.totalTransactions} volumeWei=${stats.totalVolumeWei}`);
  if ((stats.totalTransactions ?? 0) < 2) throw new Error("expected >= 2 transactions in stats");

  console.log("\n=== INTEGRATION TEST PASSED ===");
}

main()
  .catch((err) => {
    console.error("\nINTEGRATION TEST FAILED:", err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => {
    // Kill each child process group (detached) so grandchildren are cleaned up.
    for (const child of children) {
      if (child.pid) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch {
          /* already gone */
        }
      }
    }
  });
