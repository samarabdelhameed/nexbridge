import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";
import { sepolia, abstractTestnet } from "./chains";

export const wagmiConfig = getDefaultConfig({
  appName: "NexBridge",
  projectId:
    process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID ||
    "21fef48091f12692cad574a6f7753643",
  chains: [sepolia, abstractTestnet] as const,
  ssr: true,
  transports: {
    [sepolia.id]: http(),
    [abstractTestnet.id]: http(),
  },
});
