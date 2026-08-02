import Link from "next/link";
import { WalletButton } from "@/components/WalletButton";
import { Boxes, ArrowLeftRight, BarChart3 } from "lucide-react";

const navLinks = [
  { href: "/", label: "Bridge", icon: <ArrowLeftRight size={15} /> },
  { href: "/history", label: "History", icon: <Boxes size={15} /> },
  { href: "/stats", label: "Stats", icon: <BarChart3 size={15} /> },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-ink-700/60 bg-ink-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-5 py-3">
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-neon to-neon-glow font-mono text-sm font-black text-white shadow-neon">
            N
          </span>
          <span className="text-sm font-bold tracking-tight">
            Nex<span className="text-neon-soft">Bridge</span>
          </span>
        </Link>

        <nav className="flex items-center gap-1 rounded-full border border-ink-700 bg-ink-900/60 p-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:bg-ink-800 hover:text-white"
            >
              {link.icon}
              {link.label}
            </Link>
          ))}
        </nav>

        <WalletButton />
      </div>
    </header>
  );
}
