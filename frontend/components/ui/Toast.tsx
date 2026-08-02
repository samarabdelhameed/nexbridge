"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, X, XCircle } from "lucide-react";

type ToastType = "success" | "error" | "info";

export interface ToastOptions {
  type?: ToastType;
  title: string;
  message?: string;
}

interface ToastItem extends Required<Pick<ToastOptions, "type" | "title">> {
  id: number;
  message?: string;
}

interface ToastContextValue {
  toast: (opts: ToastOptions) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const ICONS: Record<ToastType, ReactNode> = {
  success: <CheckCircle2 size={18} className="shrink-0 text-mint" />,
  error: <XCircle size={18} className="shrink-0 text-coral" />,
  info: <Info size={18} className="shrink-0 text-neon-soft" />,
};

const AUTO_DISMISS_MS = 5000;
const MAX_VISIBLE = 4;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);

  const dismiss = useCallback((id: number) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (opts: ToastOptions) => {
      const id = ++idRef.current;
      setToasts((prev) => [
        ...prev.slice(-(MAX_VISIBLE - 1)),
        { id, type: opts.type ?? "info", title: opts.title, message: opts.message },
      ]);
      window.setTimeout(() => dismiss(id), AUTO_DISMISS_MS);
    },
    [dismiss],
  );

  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed bottom-5 right-5 z-[100] flex w-80 max-w-[calc(100vw-2rem)] flex-col gap-2"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role="status"
            className="animate-toast-in pointer-events-auto rounded-xl border border-ink-700 bg-ink-850/95 p-3.5 shadow-card backdrop-blur"
          >
            <div className="flex items-start gap-2.5">
              {ICONS[t.type]}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-100">{t.title}</p>
                {t.message && (
                  <p className="mt-0.5 break-words text-xs text-slate-400">
                    {t.message}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(t.id)}
                aria-label="Dismiss notification"
                className="rounded p-0.5 text-slate-500 transition hover:text-slate-200"
              >
                <X size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
