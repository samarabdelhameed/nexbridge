"use client";

import { useEffect, useMemo, useState } from "react";
import { useAccount } from "wagmi";
import { api, type BridgeTransaction } from "@/lib/api";
import { useLiveStatus } from "@/hooks/useLiveStatus";
import { explorerTxUrl } from "@/lib/chains";
import { ExternalLink, RefreshCw } from "lucide-react";

const STATUS_STYLES: Record<string, string> = {
  PENDING: "bg-amber-400/10 text-amber-300 border-amber-400/30",
  CONFIRMED: "bg-sky-400/10 text-sky-300 border-sky-400/30",
  RELEASING: "bg-neon/10 text-neon-soft border-neon/40",
  RELEASED: "bg-mint/10 text-mint border-mint/30",
  FAILED: "bg-coral/10 text-coral border-coral/40",
};

function shortHash(h: string) {
  return `${h.slice(0, 6)}…${h.slice(-4)}`;
}

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${
        STATUS_STYLES[status] ?? "border-ink-600 bg-ink-800 text-slate-400"
      }`}
    >
      {status}
    </span>
  );
}

export function TxHistoryTable() {
  const { address } = useAccount();
  const { updates } = useLiveStatus();
  const [items, setItems] = useState<BridgeTransaction[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [filterStatus, setFilterStatus] = useState<string>("");
  const [refreshKey, setRefreshKey] = useState(0);

  const queryAddress = address?.toLowerCase();

  useEffect(() => {
    if (!queryAddress) {
      setItems([]);
      return;
    }
    setLoading(true);
    setError(undefined);
    api
      .transactions(queryAddress, { status: filterStatus || undefined })
      .then((data) => setItems(data.items))
      .catch((err) => setError(err instanceof Error ? err.message : "Failed to load history"))
      .finally(() => setLoading(false));
  }, [queryAddress, filterStatus, refreshKey]);

  // Merge live socket updates into the table rows.
  const rows = useMemo(() => {
    const byHash = new Map(items.map((t) => [t.sourceTxHash, t]));
    for (const [hash, tx] of Object.entries(updates)) {
      if (!tx.userAddress || tx.userAddress === queryAddress) {
        const prev = byHash.get(hash);
        if (prev && (prev.status !== tx.status || tx.destTxHash)) byHash.set(hash, tx);
      }
    }
    return [...byHash.values()].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );
  }, [items, updates, queryAddress]);

  if (!queryAddress) {
    return (
      <p className="rounded-2xl border border-dashed border-ink-600 p-8 text-center text-sm text-slate-500">
        Connect your wallet to see bridge history.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap gap-2">
          {["", "PENDING", "CONFIRMED", "RELEASING", "RELEASED", "FAILED"].map((s) => (
            <button
              key={s || "all"}
              type="button"
              onClick={() => setFilterStatus(s)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                filterStatus === s
                  ? "bg-neon text-white"
                  : "border border-ink-600 text-slate-400 hover:text-slate-200"
              }`}
            >
              {s || "All"}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRefreshKey((k) => k + 1)}
          className="flex items-center gap-1.5 rounded-lg border border-ink-600 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-neon/50 hover:text-white"
        >
          <RefreshCw size={13} /> Refresh
        </button>
      </div>

      {error && <p className="mb-3 text-xs text-coral">{error}</p>}

      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="skeleton h-14" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-ink-600 p-8 text-center text-sm text-slate-500">
          No transfers yet. Bridge some ETH to get started.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-ink-700">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-ink-700 bg-ink-900 text-[11px] uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Direction</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Source tx</th>
                <th className="px-4 py-3">Release tx</th>
                <th className="px-4 py-3">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-ink-700/70">
              {rows.map((tx) => {
                const srcChain = tx.sourceChain === "sepolia" ? 11155111 : 11124;
                const dstChain = tx.destChain === "sepolia" ? 11155111 : 11124;
                return (
                  <tr key={tx.id} className="bg-ink-900/40 transition hover:bg-ink-800/50">
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-neon-soft">
                        {tx.direction === "L1_TO_L2" ? "L1 → L2" : "L2 → L1"}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-200">
                      {tx.amountHuman} ETH
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tx.status} />
                    </td>
                    <td className="px-4 py-3">
                      <a
                        href={explorerTxUrl(srcChain, tx.sourceTxHash)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 font-mono text-xs text-slate-300 hover:text-neon-soft"
                      >
                        {shortHash(tx.sourceTxHash)}
                        <ExternalLink size={11} />
                      </a>
                    </td>
                    <td className="px-4 py-3">
                      {tx.destTxHash ? (
                        <a
                          href={explorerTxUrl(dstChain, tx.destTxHash)}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-xs text-mint hover:underline"
                        >
                          {shortHash(tx.destTxHash)}
                          <ExternalLink size={11} />
                        </a>
                      ) : (
                        <span className="text-slate-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {new Date(tx.createdAt).toLocaleString()}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
