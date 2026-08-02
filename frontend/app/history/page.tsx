import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { TxHistoryTable } from "@/components/TxHistoryTable";

export const metadata: Metadata = {
  title: "History — NexBridge",
};

export default function HistoryPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="mb-1 text-2xl font-bold">Bridge history</h1>
        <p className="mb-8 text-sm text-slate-400">
          All your transfers, with live status updates as the relayer processes
          them.
        </p>
        <TxHistoryTable />
      </main>
    </>
  );
}
