import "./env.js";
import type { Address, Chain as ViemChain } from "viem";
import { defineChain } from "viem";
import { sepolia } from "viem/chains";

export type BridgeDirection = "L1_TO_L2" | "L2_TO_L1";

export interface ChainConfig {
  /** viem chain definition (used by public/wallet clients). */
  chain: ViemChain;
  /** Short label stored in the DB: "sepolia" | "abstract" */
  label: string;
  /** Whether this is the L1 or L2 endpoint. */
  kind: "L1" | "L2";
  /** RPC endpoint (http). */
  rpcUrl: string;
  /** WebSocket RPC endpoint (optional; falls back to HTTP polling). */
  wsUrl?: string;
  /** Deployed vault address. */
  vaultAddress: Address;
  /** Explorer URL for links (e.g. Etherscan / Blockscout). */
  explorerUrl: string;
  /** Number of confirmations before the relayer acts. */
  confirmations: number;
}

const l1RpcUrl = process.env.L1_RPC_URL ?? "http://127.0.0.1:8545";
const l2RpcUrl = process.env.L2_RPC_URL ?? "http://127.0.0.1:8546";

export const L1_CHAIN_ID = Number(process.env.L1_CHAIN_ID ?? "11155111");
export const L2_CHAIN_ID = Number(process.env.L2_CHAIN_ID ?? "11124");

const l1Chain = defineChain({
  ...sepolia,
  id: L1_CHAIN_ID,
  rpcUrls: { default: { http: [l1RpcUrl] } },
});

const l2Chain = defineChain({
  id: L2_CHAIN_ID,
  name: "Abstract Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: [l2RpcUrl] } },
  testnet: true,
});

export const l1: ChainConfig = {
  chain: l1Chain,
  label: "sepolia",
  kind: "L1",
  rpcUrl: l1RpcUrl,
  wsUrl: process.env.L1_WS_URL,
  vaultAddress: (process.env.L1_VAULT_ADDRESS ?? "") as Address,
  explorerUrl: process.env.L1_EXPLORER_URL ?? "https://sepolia.etherscan.io",
  confirmations: Number(process.env.L1_CONFIRMATIONS ?? "2"),
};

export const l2: ChainConfig = {
  chain: l2Chain,
  label: "abstract",
  kind: "L2",
  rpcUrl: l2RpcUrl,
  wsUrl: process.env.L2_WS_URL,
  vaultAddress: (process.env.L2_VAULT_ADDRESS ?? "") as Address,
  explorerUrl:
    process.env.L2_EXPLORER_URL ?? "https://explorer.testnet.abs.xyz",
  confirmations: Number(process.env.L2_CONFIRMATIONS ?? "2"),
};

export const chains: Record<"L1" | "L2", ChainConfig> = { L1: l1, L2: l2 };

export function directionFor(chain: ChainConfig): BridgeDirection {
  return chain.kind === "L1" ? "L1_TO_L2" : "L2_TO_L1";
}

export function counterChain(config: ChainConfig): ChainConfig {
  return config.kind === "L1" ? l2 : l1;
}
