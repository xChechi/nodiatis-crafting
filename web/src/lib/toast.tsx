"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { CheckCircle2, Info, X, AlertTriangle } from "lucide-react";

type ToastKind = "success" | "info" | "error";

interface Toast {
  id: number;
  kind: ToastKind;
  message: string;
  /** Optional action button label + handler */
  action?: { label: string; onClick: () => void };
}

interface ToastContextValue {
  push: (kind: ToastKind, message: string, action?: Toast["action"]) => void;
  dismiss: (id: number) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const AUTO_DISMISS_MS = 2800;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextIdRef = useRef(1);

  const dismiss = useCallback((id: number) => {
    setToasts((curr) => curr.filter((t) => t.id !== id));
  }, []);

  const push = useCallback<ToastContextValue["push"]>(
    (kind, message, action) => {
      const id = nextIdRef.current++;
      setToasts((curr) => [...curr, { id, kind, message, action }]);
    },
    [],
  );

  // Auto-dismiss every toast after AUTO_DISMISS_MS
  useEffect(() => {
    if (toasts.length === 0) return;
    const timers = toasts.map((t) =>
      setTimeout(() => dismiss(t.id), AUTO_DISMISS_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [toasts, dismiss]);

  return (
    <ToastContext.Provider value={{ push, dismiss }}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="true"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <ToastItem key={t.id} toast={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

const KIND_ICON = {
  success: CheckCircle2,
  info: Info,
  error: AlertTriangle,
} as const;

const KIND_COLOR: Record<ToastKind, string> = {
  success: "border-[var(--color-emerald)]/50 text-[var(--color-emerald)]",
  info: "border-[var(--color-azure)]/50 text-[var(--color-azure)]",
  error: "border-[var(--color-rust)]/50 text-[var(--color-rust)]",
};

function ToastItem({
  toast,
  onDismiss,
}: {
  toast: Toast;
  onDismiss: () => void;
}) {
  const Icon = KIND_ICON[toast.kind];
  return (
    <div
      role="status"
      className={`pointer-events-auto flex items-center gap-3 px-3 py-2 min-w-[260px] max-w-sm bg-[var(--color-bg-2)] border ${KIND_COLOR[toast.kind]} rounded-md shadow-lg text-sm animate-[toast-in_180ms_ease-out]`}
    >
      <Icon size={14} className="shrink-0" aria-hidden="true" />
      <span className="flex-1 text-[var(--color-fg-1)]">{toast.message}</span>
      {toast.action && (
        <button
          onClick={() => {
            toast.action?.onClick();
            onDismiss();
          }}
          className="text-xs uppercase tracking-wider px-2 py-1 rounded border border-[var(--color-border)] text-[var(--color-fg-2)] hover:text-[var(--color-fg-1)]"
        >
          {toast.action.label}
        </button>
      )}
      <button
        onClick={onDismiss}
        aria-label="Dismiss notification"
        className="text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)]"
      >
        <X size={13} aria-hidden="true" />
      </button>
    </div>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx)
    throw new Error("useToast must be used inside <ToastProvider>");
  return ctx;
}
