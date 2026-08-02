"use client";

import { useEffect, useState } from "react";
import { api, type Stats } from "@/lib/api";
import { formatEther } from "viem";
import { ArrowLeftRight, Coins, Route, ArrowUpRight, ArrowDownLeft } from "lucide-react";

const ACCENTS: Record<string, string> = {
  mint: "text-mint",
  neon: "text-neon",
  "neon-soft": "text-neon-soft",
  coral: "text-coral",
};

function StatCard({
  label,
  value,
  icon,
  accent,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: string;
}) {
  return (
    <div className="rounded-2xl border border-ink-700 bg-ink-900/70 p-5">
      <div className="mb-3 flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500">
        <span className={ACCENTS[accent] ?? "text-slate-400"}>{icon}</span>
        {label}
      </div>
      <p className="font-mono text-2xl font-bold text-slate-100">{value}</p>
    </div>
  );
}

export function StatsView() {
  const [stats, setStats] = useState<Stats>();
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .stats()
      .then(setStats)
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load stats"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="grid grid-cols-2 gap-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="skeleton h-28" />
        ))}
      </div>
    );
  }

  if (error || !stats) {
    return (
      <p className="rounded-2xl border border-dashed border-ink-600 p-8 text-center text-sm text-coral">
        {error ?? "Stats unavailable."}
      </p>
    );
  }

  const totalVolumeEth = Number(formatEther(BigInt(stats.totalVolumeWei))).toFixed(4);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          label="Total volume"
          value={`${totalVolumeEth} ETH`}
          icon={<Coins size={14} />}
          accent="mint"
        />
        <StatCard
          label="Transfers"
          value={String(stats.totalTransactions)}
          icon={<ArrowLeftRight size={14} />}
          accent="neon"
        />
        <StatCard
          label="L1 → L2"
          value={String(stats.breakdown.L1_TO_L2)}
          icon={<ArrowUpRight size={14} />}
          accent="neon-soft"
        />
        <StatCard
          label="L2 → L1"
          value={String(stats.breakdown.L2_TO_L1)}
          icon={<ArrowDownLeft size={14} />}
          accent="coral"
        />
      </div>

      <div className="rounded-2xl border border-ink-700 bg-ink-900/70 p-5">
        <div className="mb-4 flex items-center gap-2 text-xs uppercase tracking-widest text-slate-500">
          <Route size={14} className="text-neon" />
          Status breakdown
        </div>
        <div className="flex h-3 w-full overflow-hidden rounded-full bg-ink-800">
          {Object.entries(stats.byStatus).map(([status, count]) => {
            const total = stats.totalTransactions || 1;
            const pct = Math.round((count / total) * 100);
            const color =
              status === "RELEASED"
                ? "bg-mint"
                : status === "FAILED"
                  ? "bg-coral"
                  : status === "RELEASING"
                    ? "bg-neon"
                    : status === "CONFIRMED"
                      ? "bg-sky-500"
                      : "bg-amber-400";
            return (
              <div
                key={status}
                className={`${color} transition-all`}
                style={{ width: `${pct}%` }}
                title={`${status}: ${count}`}
              />
            );
          })}
        </div>
        <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-400">
          {Object.entries(stats.byStatus).map(([status, count]) => (
            <span key={status} className="flex items-center gap-1.5">
              <span
                className={`h-2 w-2 rounded-full ${
                  status === "RELEASED"
                    ? "bg-mint"
                    : status === "FAILED"
                      ? "bg-coral"
                      : status === "RELEASING"
                        ? "bg-neon"
                        : status === "CONFIRMED"
                          ? "bg-sky-500"
                          : "bg-amber-400"
                }`}
              />
              {status}: <span className="font-mono text-slate-200">{count}</span>
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
