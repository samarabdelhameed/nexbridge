"use client";

import dynamic from "next/dynamic";

/**
 * Providers are loaded client-side only. Wallet SDKs (MetaMask, WalletConnect)
 * touch browser-only globals (indexedDB, localStorage) that do not exist on the
 * server, so we skip server rendering of the provider tree entirely.
 */
const ClientProviders = dynamic(
  () => import("./providers").then((m) => m.Providers),
  {
    ssr: false,
  },
);

export default function AppProviders({
  children,
}: {
  children: React.ReactNode;
}) {
  return <ClientProviders>{children}</ClientProviders>;
}
