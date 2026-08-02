import type { Metadata } from "next";
import { SiteHeader } from "@/components/SiteHeader";
import { StatsView } from "@/components/StatsView";

export const metadata: Metadata = {
  title: "Stats — NexBridge",
};

export default function StatsPage() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-5xl px-5 py-12">
        <h1 className="mb-1 text-2xl font-bold">Network stats</h1>
        <p className="mb-8 text-sm text-slate-400">
          Aggregate bridge volume and status breakdown across both chains.
        </p>
        <StatsView />
      </main>
    </>
  );
}
