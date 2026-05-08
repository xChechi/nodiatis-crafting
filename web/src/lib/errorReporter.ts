// Client-side error reporter. Posts to /api/errors via sendBeacon (preferred,
// survives page unload) with a fetch fallback. Deduplicates noisy bursts so a
// single broken loop doesn't spam the endpoint.

interface ReportInput {
  message: string;
  stack?: string;
  kind?: "render" | "promise" | "window" | "manual";
  source?: string;
}

const recent = new Map<string, number>();
const DEDUPE_WINDOW_MS = 30_000;
const MAX_RECENT_KEYS = 100;

function shouldSend(key: string): boolean {
  const now = Date.now();
  // Garbage-collect old keys so the map can't grow without bound.
  if (recent.size > MAX_RECENT_KEYS) {
    for (const [k, t] of recent) {
      if (now - t > DEDUPE_WINDOW_MS) recent.delete(k);
    }
  }
  const last = recent.get(key);
  if (last !== undefined && now - last < DEDUPE_WINDOW_MS) return false;
  recent.set(key, now);
  return true;
}

export function reportError(input: ReportInput): void {
  if (typeof window === "undefined") return;

  const key = `${input.kind ?? "unknown"}:${input.message}`;
  if (!shouldSend(key)) return;

  const payload = JSON.stringify({
    message: input.message,
    stack: input.stack,
    source: input.source,
    kind: input.kind ?? "manual",
    url: window.location.href,
    userAgent: navigator.userAgent,
  });

  try {
    if (navigator.sendBeacon) {
      const blob = new Blob([payload], { type: "application/json" });
      const sent = navigator.sendBeacon("/api/errors", blob);
      if (sent) return;
    }
  } catch {
    // fall through to fetch
  }

  // keepalive lets the browser finish the request even on unload
  void fetch("/api/errors", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: payload,
    keepalive: true,
  }).catch(() => {
    // The reporter must never throw — if even the fallback fails we drop
    // the error rather than crashing whatever called us.
  });
}

/** Install global handlers for window errors and unhandled promise rejections. */
export function installGlobalErrorHandlers(): void {
  if (typeof window === "undefined") return;

  window.addEventListener("error", (event) => {
    reportError({
      message: event.message || "window error",
      stack: event.error?.stack,
      source: event.filename,
      kind: "window",
    });
  });

  window.addEventListener("unhandledrejection", (event) => {
    const reason: unknown = event.reason;
    const message =
      reason instanceof Error
        ? reason.message
        : typeof reason === "string"
          ? reason
          : "unhandled promise rejection";
    const stack = reason instanceof Error ? reason.stack : undefined;
    reportError({ message, stack, kind: "promise" });
  });
}
