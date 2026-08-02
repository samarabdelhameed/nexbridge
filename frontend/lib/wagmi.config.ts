import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { defineChain } from "viem";
import { http } from "wagmi";
import { sepolia } from "wagmi/chains";

export const abstractTestnet = defineChain({
  id: 11124,
  name: "Abstract Testnet",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://api.testnet.abs.xyz"] },
  },
  blockExplorers: {
    default: { name: "Abstract Explorer", url: "https://explorer.testnet.abs.xyz" },
  },
  testnet: true,
});

// Public free RPCs hardcoded as defaults so end users need zero setup.
// Wallet balances, bridge deposits and explorer links all work out of the box.
const L1_RPC = process.env.NEXT_PUBLIC_L1_RPC_URL ?? "https://ethereum-sepolia-rpc.publicnode.com";
const L2_RPC = process.env.NEXT_PUBLIC_L2_RPC_URL ?? "https://api.testnet.abs.xyz";

export const wagmiConfig = getDefaultConfig({
  appName: "NexBridge",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    "21fef48091f12692cad574a6f7753643",
  chains: [sepolia, abstractTestnet],
  ssr: true,
  transports: {
    // Stable public RPCs — no API key needed for end users
    [sepolia.id]: http(L1_RPC),
    [abstractTestnet.id]: http(L2_RPC),
  },
});
