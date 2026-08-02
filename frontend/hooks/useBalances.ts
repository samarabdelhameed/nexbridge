"use client";

import { useEffect, useState } from "react";
import { useAccount, useBalance, useChainId } from "wagmi";
import { sepolia, abstractTestnet } from "@/lib/chains";

interface BalanceData {
  value: bigint;
  decimals: number;
  formatted: string;
  symbol: string;
}

/**
 * Balances on both chains. All values come from real RPCs — nothing is
 * hardcoded or mocked.
 */
export function useBalances() {
  const { address } = useAccount();
  const chainId = useChainId();

  const l1Balance = useBalance({ address, chainId: sepolia.id });
  const l2Balance = useBalance({ address, chainId: abstractTestnet.id });

  const [formatted, setFormatted] = useState<{
    l1: string;
    l2: string;
    active: string;
  }>({ l1: "--", l2: "--", active: "--" });

  useEffect(() => {
    const f = (b: { data?: BalanceData | undefined }) =>
      b.data ? Number(b.data.formatted).toFixed(4) : "--";
    const active =
      chainId === sepolia.id
        ? f(l1Balance)
        : chainId === abstractTestnet.id
          ? f(l2Balance)
          : "--";
    setFormatted({ l1: f(l1Balance), l2: f(l2Balance), active });
  }, [l1Balance.data, l2Balance.data, chainId]);

  return { l1: l1Balance.data, l2: l2Balance.data, formatted };
}
