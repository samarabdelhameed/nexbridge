"use client";

import { Check, Loader2, X } from "lucide-react";
import type { BridgeStatus } from "@/lib/api";

type ProgressState = "done" | "active" | "pending" | "failed";

interface Step {
  key: string;
  label: string;
  hint?: string;
}

const STEPS: Step[] = [
  { key: "deposit", label: "Deposit confirmed", hint: "ETH locked in source vault" },
  { key: "relayer", label: "Relayer picked up", hint: "Watching event & confirming" },
  { key: "released", label: "Released on destination", hint: "ETH sent to your wallet" },
];

function stateFor(status: BridgeStatus): ProgressState {
  switch (status) {
    case "PENDING":
      return "active"; // deposit observed, awaiting confirmations
    case "CONFIRMED":
      return "done"; // deposit step complete; relayer step active next
    case "RELEASING":
      return "done"; // relayer picked up
    case "RELEASED":
      return "done";
    case "FAILED":
      return "failed";
  }
}

export function ProgressTracker({
  status,
  errorMessage,
}: {
  status?: BridgeStatus;
  errorMessage?: string | null;
}) {
  const s = status ? stateFor(status) : "pending";
  const stepIndex = status
    ? status === "RELEASED"
      ? 2
      : status === "RELEASING"
        ? 1
        : status === "CONFIRMED"
          ? 1
          : 0
    : -1;

  return (
    <div>
      <ol className="relative space-y-6">
        <span
          className="absolute left-[15px] top-3 bottom-3 w-px bg-ink-700"
          aria-hidden
        />
        {STEPS.map((step, i) => {
          const isDone = stepIndex >= i;
          const isActive = status !== "RELEASED" && status !== "FAILED" && stepIndex === i;
          return (
            <li key={step.key} className="relative flex items-start gap-4 pl-0">
              <span
                className={`z-10 flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 ${
                  isDone
                    ? "border-mint bg-mint/15 text-mint"
                    : isActive
                      ? "border-neon bg-neon/15 text-neon animate-pulse-slow"
                      : "border-ink-600 bg-ink-900 text-slate-600"
                }`}
              >
                {isDone ? (
                  <Check size={14} />
                ) : isActive ? (
                  <Loader2 size={14} className="animate-spin" />
                ) : (
                  <span className="h-1.5 w-1.5 rounded-full bg-current" />
                )}
              </span>
              <div className="pt-0.5">
                <p
                  className={`text-sm font-semibold ${
                    isDone || isActive ? "text-slate-100" : "text-slate-500"
                  }`}
                >
                  {step.label}
                </p>
                <p className="text-xs text-slate-500">{step.hint}</p>
              </div>
            </li>
          );
        })}
      </ol>

      {s === "failed" && (
        <div className="mt-5 flex items-start gap-2 rounded-xl border border-coral/40 bg-coral/10 p-3">
          <X size={16} className="mt-0.5 shrink-0 text-coral" />
          <div>
            <p className="text-sm font-semibold text-coral">Transfer failed</p>
            <p className="text-xs text-slate-300">
              {errorMessage ?? "The relayer could not complete this transfer."}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
