"use client";

import { useEstimateGas, useGasPrice } from "wagmi";
import { encodeFunctionData, formatEther, parseEther, type Address } from "viem";
import { vaultAbi } from "@/lib/contracts";

interface GasEstimateInput {
  account?: Address;
  to?: Address;
  amount?: string;
  chainId: number;
  enabled: boolean;
}

/**
 * Real gas estimate for the vault `deposit()` call on the source chain using
 * wagmi's useEstimateGas. Returns the estimated ETH cost (gas × gas price)
 * formatted to 7 decimals, or undefined when it cannot be computed.
 */
export function useGasEstimate({
  account,
  to,
  amount,
  chainId,
  enabled,
}: GasEstimateInput) {
  const canEstimate =
    enabled && Boolean(account && to && amount && Number(amount) > 0);

  const { data: gas } = useEstimateGas({
    account,
    to,
    value: canEstimate && amount ? parseEther(amount) : undefined,
    data: to ? encodeFunctionData({ abi: vaultAbi, functionName: "deposit" }) : undefined,
    chainId,
    query: { enabled: canEstimate },
  });

  const { data: gasPrice } = useGasPrice({ chainId, query: { enabled: canEstimate } });

  const cost = gas && gasPrice ? gas * gasPrice : undefined;

  return {
    gasCostEth: cost ? Number(formatEther(cost)).toFixed(7) : undefined,
  };
}
