"use client";

import { Coins } from "lucide-react";

interface Props {
  value: string;
  onChange: (value: string) => void;
  balanceEth?: string;
  onMax?: () => void;
  disabled?: boolean;
}

export function AmountInput({ value, onChange, balanceEth, onMax, disabled }: Props) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900 p-4 focus-within:border-neon/60">
      <div className="mb-2 flex items-center justify-between text-xs text-slate-400">
        <span className="font-mono uppercase tracking-widest">amount (ETH)</span>
        {balanceEth && (
          <span className="flex items-center gap-1">
            <Coins size={12} />
            balance:{" "}
            <span className="font-medium text-slate-200">{balanceEth}</span>
            {onMax && (
              <button
                type="button"
                onClick={onMax}
                disabled={disabled}
                className="ml-1 rounded-md bg-neon/15 px-2 py-0.5 text-[10px] font-semibold text-neon-soft transition hover:bg-neon/25 disabled:opacity-40"
              >
                MAX
              </button>
            )}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2">
        <input
          type="number"
          inputMode="decimal"
          min="0"
          step="0.0001"
          placeholder="0.0"
          value={value}
          disabled={disabled}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-transparent font-mono text-3xl font-semibold text-slate-100 outline-none placeholder:text-slate-600 disabled:opacity-50"
        />
        <span className="rounded-lg bg-ink-700 px-3 py-1.5 font-mono text-sm font-bold text-neon-soft">
          ETH
        </span>
      </div>
    </div>
  );
}
