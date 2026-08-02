import { SiteHeader } from "@/components/SiteHeader";
import { BridgeCard } from "@/components/BridgeCard";

export default function Home() {
  return (
    <>
      <SiteHeader />
      <main className="mx-auto flex max-w-5xl flex-col items-center px-5 py-16">
        <div className="mb-10 text-center">
          <h1 className="text-4xl font-black tracking-tight sm:text-5xl">
            Move ETH across chains
            <span className="block bg-gradient-to-r from-neon-soft via-neon-glow to-mint bg-clip-text text-transparent">
              in one click.
            </span>
          </h1>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-relaxed text-slate-400">
            NexBridge is a lock-and-release cross-chain bridge for test ETH —
            Sepolia ⇄ Abstract Testnet — powered by a live off-chain relayer with
            real-time status tracking.
          </p>
        </div>
        <BridgeCard />
      </main>
    </>
  );
}
