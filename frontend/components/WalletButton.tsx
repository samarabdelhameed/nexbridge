"use client";

import { ConnectButton } from "@rainbow-me/rainbowkit";

export function WalletButton() {
  return (
    <ConnectButton
      showBalance={{ smallScreen: true, largeScreen: true }}
      chainStatus={{ smallScreen: "icon", largeScreen: "full" }}
    />
  );
}
