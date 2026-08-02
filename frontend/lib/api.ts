export type BridgeStatus =
  | "PENDING"
  | "CONFIRMED"
  | "RELEASING"
  | "RELEASED"
  | "FAILED";

export interface BridgeTransaction {
  id: string;
  userAddress: string;
  direction: "L1_TO_L2" | "L2_TO_L1";
  amount: string;
  amountHuman: string;
  sourceChain: string;
  destChain: string;
  sourceTxHash: string;
  destTxHash?: string | null;
  nonce: string;
  status: BridgeStatus;
  attempts: number;
  errorMessage?: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Stats {
  totalTransactions: number;
  totalVolumeWei: string;
  breakdown: { L1_TO_L2: number; L2_TO_L1: number };
  byStatus: Record<string, number>;
}

export interface Health {
  ok: boolean;
  database: { ok: boolean };
  relayer: { ok: boolean; address?: string; balanceEth: string };
  chains: { l1: { ok: boolean }; l2: { ok: boolean } };
}

const API_URL =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? "http://localhost:8080";

async function getJson<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    signal,
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    throw new Error(`API ${res.status}: ${res.statusText}`);
  }
  return (await res.json()) as T;
}

export const api = {
  baseUrl: API_URL,

  transactions(address: string, filters?: { direction?: string; status?: string }): Promise<{ total: number; items: BridgeTransaction[] }> {
    const params = new URLSearchParams({ limit: "100" });
    if (filters?.direction) params.set("direction", filters.direction);
    if (filters?.status) params.set("status", filters.status);
    return getJson(`/api/transactions/${address}?${params.toString()}`);
  },

  transaction(txHash: string): Promise<BridgeTransaction> {
    return getJson(`/api/transaction/${txHash}`);
  },

  stats(): Promise<Stats> {
    return getJson("/api/stats");
  },

  health(): Promise<Health> {
    return getJson("/api/health");
  },
};
