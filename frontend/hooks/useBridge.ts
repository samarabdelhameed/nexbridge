"use client";

import { useCallback, useMemo, useState } from "react";
import { parseEther, type Address } from "viem";
import {
  useAccount,
  useChainId,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { sepolia, abstractTestnet, type BridgeDirection } from "@/lib/chains";
import { vaultAbi, L1_VAULT_ADDRESS, L2_VAULT_ADDRESS } from "@/lib/contracts";

export type BridgePhase =
  | "idle"
  | "pending" // wallet confirm
  | "mined" // deposit tx mined on source
  | "released" // relayer finished
  | "error";

export interface BridgeState {
  direction: BridgeDirection;
  amount: string;
  phase: BridgePhase;
  sourceTxHash?: `0x${string}`;
  errorMessage?: string;
  sourceChainId: number;
  destChainId: number;
  canBridge: boolean;
}

/**
 * Orchestrates the source-chain deposit via wagmi. The status of the transfer
 * after the deposit is tracked live through the backend WebSocket channel
 * (see useLiveStatus / ProgressTracker).
 */
export function useBridge() {
  const { isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  const [direction, setDirection] = useState<BridgeDirection>("L1_TO_L2");
  const [amount, setAmount] = useState("");
  const [phase, setPhase] = useState<BridgePhase>("idle");
  const [sourceTxHash, setSourceTxHash] = useState<`0x${string}`>();
  const [errorMessage, setErrorMessage] = useState<string>();

  const { data: writeHash, isPending: isWritePending, error, writeContract } =
    useWriteContract();

  const { data: receipt, isSuccess: isMined } = useWaitForTransactionReceipt({
    hash: writeHash,
    confirmations: 1,
  });

  const sourceChainId = direction === "L1_TO_L2" ? sepolia.id : abstractTestnet.id;
  const destChainId = direction === "L1_TO_L2" ? abstractTestnet.id : sepolia.id;
  const vaultAddress =
    direction === "L1_TO_L2" ? L1_VAULT_ADDRESS : L2_VAULT_ADDRESS;

  const onWrongNetwork = useMemo(
    () => isConnected && chainId !== undefined && chainId !== sourceChainId,
    [isConnected, chainId, sourceChainId],
  );

  const canBridge = useMemo(
    () =>
      isConnected &&
      !onWrongNetwork &&
      Boolean(vaultAddress) &&
      amount !== "" &&
      Number(amount) > 0 &&
      !isWritePending,
    [isConnected, onWrongNetwork, vaultAddress, amount, isWritePending],
  );

  const switchToSourceChain = useCallback(async () => {
    setErrorMessage(undefined);
    try {
      await switchChain({ chainId: sourceChainId });
    } catch {
      setErrorMessage("Network switch cancelled or failed.");
    }
  }, [switchChain, sourceChainId]);

  const deposit = useCallback(async () => {
    setErrorMessage(undefined);
    if (!vaultAddress || !amount) return;
    try {
      setPhase("pending");
      setSourceTxHash(undefined);
      writeContract({
        address: vaultAddress as Address,
        abi: vaultAbi,
        functionName: "deposit",
        value: parseEther(amount),
        chainId: sourceChainId,
      });
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : "Deposit failed.");
      setPhase("error");
    }
  }, [vaultAddress, amount, writeContract, sourceChainId]);

  // Sync phases from wagmi state.
  if (isMined && receipt && phase === "pending") {
    setPhase("mined");
    if (receipt.transactionHash !== sourceTxHash) {
      setSourceTxHash(receipt.transactionHash);
    }
  } else if (writeHash && phase === "pending" && !sourceTxHash && !isMined) {
    setSourceTxHash(writeHash);
  } else if (error && phase !== "error") {
    setErrorMessage(error.message ?? "Transaction failed.");
    setPhase("error");
  } else if (isWritePending && phase === "idle") {
    setPhase("pending");
  }

  const reset = useCallback(() => {
    setPhase("idle");
    setSourceTxHash(undefined);
    setErrorMessage(undefined);
  }, []);

  return {
    state: {
      direction,
      amount,
      phase,
      sourceTxHash,
      errorMessage,
      sourceChainId,
      destChainId,
      canBridge,
    } satisfies BridgeState,
    setDirection,
    setAmount,
    deposit,
    reset,
    switchToSourceChain,
    onWrongNetwork,
    isWritePending,
    error,
  };
}
