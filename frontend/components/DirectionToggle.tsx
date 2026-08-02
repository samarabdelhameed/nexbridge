"use client";

import { ArrowDownUp } from "lucide-react";
import { sepolia, abstractTestnet, type BridgeDirection } from "@/lib/chains";

interface Props {
  direction: BridgeDirection;
  onChange: (direction: BridgeDirection) => void;
  disabled?: boolean;
}

export function DirectionToggle({ direction, onChange, disabled }: Props) {
  const from = direction === "L1_TO_L2" ? "Sepolia" : "Abstract Testnet";
  const to = direction === "L1_TO_L2" ? "Abstract Testnet" : "Sepolia";

  return (
    <div className="flex items-center justify-between gap-3">
      <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-2xl border border-ink-700 bg-ink-900 p-2">
        <div className="flex flex-col items-center rounded-xl bg-ink-800 px-3 py-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-neon-soft">
            from
          </span>
          <span className="text-sm font-semibold">{from}</span>
          <span className="text-xs text-slate-400">
            {direction === "L1_TO_L2" ? "L1" : "L2"}
          </span>
        </div>

        <button
          type="button"
          disabled={disabled}
          onClick={() =>
            onChange(direction === "L1_TO_L2" ? "L2_TO_L1" : "L1_TO_L2")
          }
          aria-label="Swap direction"
          className="rounded-full border border-neon/40 p-2 text-neon transition hover:rotate-180 hover:bg-neon/10 disabled:opacity-40"
        >
          <ArrowDownUp size={18} />
        </button>

        <div className="flex flex-col items-center rounded-xl bg-ink-800 px-3 py-2">
          <span className="font-mono text-[11px] uppercase tracking-widest text-mint">
            to
          </span>
          <span className="text-sm font-semibold">{to}</span>
          <span className="text-xs text-slate-400">
            {direction === "L1_TO_L2" ? "L2" : "L1"}
          </span>
        </div>
      </div>
    </div>
  );
}
