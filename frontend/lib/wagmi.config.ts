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

export const wagmiConfig = getDefaultConfig({
  appName: "NexBridge",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "nexbridge-dev",
  chains: [sepolia, abstractTestnet],
  ssr: true,
  transports: {
    // Public stable RPCs — no API key needed for end users
    [sepolia.id]: http("https://rpc2.sepolia.org"),
    [abstractTestnet.id]: http("https://api.testnet.abs.xyz"),
  },
});
