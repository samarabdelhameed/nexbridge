import { defineChain } from "viem";

export const L1_CHAIN_ID = 11155111;
export const L2_CHAIN_ID = 11124;

export const sepolia = defineChain({
  id: L1_CHAIN_ID,
  name: "Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://ethereum-sepolia-rpc.publicnode.com"],
    },
  },
  testnet: true,
});

export const abstractTestnet = defineChain({
  id: L2_CHAIN_ID,
  name: "Abstract Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: {
      http: ["https://api.testnet.abs.xyz"],
    },
  },
  testnet: true,
});

export const chains = [sepolia, abstractTestnet] as const;

export const chainMeta = {
  [L1_CHAIN_ID]: {
    label: "Sepolia",
    short: "L1",
    explorerUrl:
      process.env.NEXT_PUBLIC_L1_EXPLORER_URL ?? "https://sepolia.etherscan.io",
  },
  [L2_CHAIN_ID]: {
    label: "Abstract Testnet",
    short: "L2",
    explorerUrl:
      process.env.NEXT_PUBLIC_L2_EXPLORER_URL ??
      "https://explorer.testnet.abs.xyz",
  },
} as const;

export type BridgeDirection = "L1_TO_L2" | "L2_TO_L1";

export function explorerTxUrl(chainId: number, hash: string): string {
  return `${chainMeta[chainId as keyof typeof chainMeta].explorerUrl}/tx/${hash}`;
}
