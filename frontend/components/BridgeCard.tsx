"use client";

import { useEffect, useMemo, useRef } from "react";
import { parseEther } from "viem";
import { useAccount } from "wagmi";
import { WalletButton } from "./WalletButton";
import { DirectionToggle } from "./DirectionToggle";
import { AmountInput } from "./AmountInput";
import { ProgressTracker } from "./ProgressTracker";
import { useBridge } from "@/hooks/useBridge";
import { useBalances } from "@/hooks/useBalances";
import { useGasEstimate } from "@/hooks/useGasEstimate";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import { useToast } from "@/components/ui/Toast";
import { sepolia, abstractTestnet, explorerTxUrl } from "@/lib/chains";
import { L1_VAULT_ADDRESS, L2_VAULT_ADDRESS } from "@/lib/contracts";
import { Link2, Zap } from "lucide-react";

export function BridgeCard() {
  const bridge = useBridge();
  const { address, isConnected } = useAccount();
  const { l1, l2, formatted } = useBalances();
  const { latest } = useLiveStatus();
  const { toast } = useToast();

  const {
    state: { direction, amount, phase, sourceTxHash, errorMessage, sourceChainId, destChainId, canBridge },
    setDirection,
    setAmount,
    deposit,
    reset,
    switchToSourceChain,
    onWrongNetwork,
  } = bridge;

  const activeBalance = direction === "L1_TO_L2" ? formatted.l1 : formatted.l2;
  const activeBalanceValue =
    direction === "L1_TO_L2" ? l1?.value : l2?.value;
  const activeChainId = direction === "L1_TO_L2" ? sepolia.id : abstractTestnet.id;
  const sourceVault = direction === "L1_TO_L2" ? L1_VAULT_ADDRESS : L2_VAULT_ADDRESS;

  const liveStatus = useMemo(
    () => (sourceTxHash ? latest(sourceTxHash) : undefined),
    [sourceTxHash, latest],
  );

  const { gasCostEth } = useGasEstimate({
    account: address,
    to: sourceVault,
    amount,
    chainId: sourceChainId,
    enabled: isConnected && !onWrongNetwork,
  });

  const handleMax = () => {
    if (activeBalance !== "--") setAmount(activeBalance);
  };

  // --- Notifications ----------------------------------------------------
  const releasedNotified = useRef<string>();

  useEffect(() => {
    if (onWrongNetwork) {
      toast({
        type: "info",
        title: "Wrong network",
        message: `Switch to ${direction === "L1_TO_L2" ? "Sepolia" : "Abstract Testnet"} to bridge.`,
      });
    }
  }, [onWrongNetwork, direction, toast]);

  useEffect(() => {
    if (phase === "mined" && sourceTxHash) {
      toast({
        type: "success",
        title: "Deposit confirmed",
        message: "ETH locked in the source vault. Relayer is releasing now.",
      });
    }
  }, [phase, sourceTxHash, toast]);

  useEffect(() => {
    if (
      liveStatus?.status === "RELEASED" &&
      liveStatus.destTxHash &&
      releasedNotified.current !== liveStatus.destTxHash
    ) {
      releasedNotified.current = liveStatus.destTxHash;
      toast({
        type: "success",
        title: "Bridge complete",
        message: `${liveStatus.amountHuman ?? amount} ETH released on the destination chain.`,
      });
    }
  }, [liveStatus, amount, toast]);

  useEffect(() => {
    if (phase === "error" && errorMessage) {
      toast({ type: "error", title: "Bridge failed", message: errorMessage });
    }
  }, [phase, errorMessage, toast]);

  const handleDeposit = () => {
    if (activeBalanceValue && amount && Number(amount) > 0) {
      try {
        if (parseEther(amount) > activeBalanceValue) {
          toast({
            type: "error",
            title: "Insufficient balance",
            message: `You have ${activeBalance} ETH on the source chain.`,
          });
          return;
        }
      } catch {
        toast({ type: "error", title: "Invalid amount", message: "Enter a valid ETH amount." });
        return;
      }
    }
    if (onWrongNetwork) {
      switchToSourceChain();
      return;
    }
    deposit();
  };

  return (
    <div className="w-full max-w-md rounded-3xl border border-ink-700 bg-ink-900/80 p-6 shadow-card backdrop-blur">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Bridge ETH</h2>
          <p className="text-xs text-slate-400">
            Sepolia ⇄ Abstract Testnet · testnet
          </p>
        </div>
        <span className="flex items-center gap-1.5 rounded-full border border-mint/30 bg-mint/10 px-3 py-1 text-xs font-medium text-mint">
          <Zap size={12} /> Live
        </span>
      </div>

      <div className="space-y-4">
        <DirectionToggle
          direction={direction}
          onChange={(d) => {
            setDirection(d);
            reset();
          }}
          disabled={phase === "pending" || phase === "mined"}
        />

        <AmountInput
          value={amount}
          onChange={setAmount}
          balanceEth={activeBalance}
          onMax={handleMax}
          disabled={phase === "pending" || phase === "mined"}
        />

        <div className="flex items-center justify-between px-1 text-[11px] text-slate-500">
          <span>Estimated gas</span>
          <span className="font-mono text-slate-400">
            {gasCostEth ? `~${gasCostEth} ETH` : "—"}
          </span>
        </div>

        {onWrongNetwork && (
          <button
            type="button"
            onClick={switchToSourceChain}
            className="w-full rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-3 text-sm font-semibold text-amber-300 transition hover:bg-amber-400/20"
          >
            Switch to {direction === "L1_TO_L2" ? "Sepolia" : "Abstract Testnet"}
          </button>
        )}

        {phase === "idle" || phase === "error" ? (
          <button
            type="button"
            disabled={!canBridge}
            onClick={handleDeposit}
            className="w-full rounded-xl bg-neon px-4 py-3.5 text-sm font-bold text-white shadow-neon transition hover:brightness-110 active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
          >
            Bridge {amount ? `${amount} ETH` : ""}
          </button>
        ) : (
          <div className="rounded-xl border border-ink-700 bg-ink-850 p-4">
            <ProgressTracker status={liveStatus?.status} errorMessage={liveStatus?.errorMessage} />
            {sourceTxHash && (
              <a
                href={explorerTxUrl(activeChainId, sourceTxHash)}
                target="_blank"
                rel="noreferrer"
                className="mt-4 inline-flex items-center gap-1.5 text-xs font-medium text-neon-soft underline-offset-2 hover:underline"
              >
                <Link2 size={12} /> View source tx
              </a>
            )}
            {liveStatus?.destTxHash && (
              <a
                href={explorerTxUrl(destChainId, liveStatus.destTxHash)}
                target="_blank"
                rel="noreferrer"
                className="mt-1 inline-flex items-center gap-1.5 text-xs font-medium text-mint underline-offset-2 hover:underline"
              >
                <Link2 size={12} /> View release tx on destination
              </a>
            )}
            {liveStatus?.status === "RELEASED" && (
              <button
                type="button"
                onClick={reset}
                className="mt-4 w-full rounded-xl border border-mint/40 bg-mint/10 px-4 py-2.5 text-sm font-semibold text-mint transition hover:bg-mint/20"
              >
                New bridge
              </button>
            )}
          </div>
        )}

        {errorMessage && phase === "error" && (
          <p className="text-xs text-coral">{errorMessage}</p>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-ink-700 pt-4">
          <WalletButton />
          <div className="text-right text-[11px] text-slate-500">
            <p>
              L1 <span className="font-mono text-slate-300">{formatted.l1}</span>
            </p>
            <p>
              L2 <span className="font-mono text-slate-300">{formatted.l2}</span>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
