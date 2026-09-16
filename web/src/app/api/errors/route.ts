import { NextResponse } from "next/server";

// Minimal client-error sink. The client posts here from window.onerror /
// unhandledrejection / React error boundaries; we log to stdout so Vercel's
// runtime logs catch them. Swap in Sentry/Datadog later by changing only
// this handler — call sites stay the same.

export const runtime = "edge";

interface ErrorPayload {
  message: string;
  stack?: string;
  source?: string;
  url?: string;
  userAgent?: string;
  /** "render" | "promise" | "window" | "manual" — where the error originated. */
  kind?: string;
}

const MAX_BYTES = 8 * 1024;

// Per-IP flood guard. This endpoint is unauthenticated (sendBeacon can't carry a
// custom header), so the only key available is the caller's IP. State lives in the
// isolate's memory: it is BEST-EFFORT — edge isolates are per-region and recycled,
// so a distributed flood still gets through. It exists to stop one noisy client
// filling the runtime logs; the answer to a real distributed flood is Vercel's
// firewall, not this.
const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 20;
const MAX_TRACKED_IPS = 5_000;

const hits = new Map<string, number[]>();

function clientIp(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const first = forwarded?.split(",")[0]?.trim();
  return first || request.headers.get("x-real-ip") || "unknown";
}

function overRateLimit(ip: string): boolean {
  const now = Date.now();
  const recent = (hits.get(ip) ?? []).filter((t) => now - t < WINDOW_MS);

  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(ip, recent);
    return true;
  }

  recent.push(now);
  hits.set(ip, recent);

  // Bound memory: Map keeps insertion order, so the first key is the stalest.
  if (hits.size > MAX_TRACKED_IPS) {
    const oldest = hits.keys().next().value;
    if (oldest !== undefined) hits.delete(oldest);
  }

  return false;
}

export async function POST(request: Request) {
  if (overRateLimit(clientIp(request))) {
    return NextResponse.json(
      { ok: false, reason: "rate-limited" },
      { status: 429, headers: { "Retry-After": "60" } },
    );
  }

  let payload: ErrorPayload;
  try {
    const text = await request.text();
    if (text.length > MAX_BYTES) {
      return NextResponse.json({ ok: false, reason: "too-large" }, { status: 413 });
    }
    payload = JSON.parse(text) as ErrorPayload;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  if (!payload?.message || typeof payload.message !== "string") {
    return NextResponse.json({ ok: false, reason: "missing-message" }, { status: 400 });
  }

  // Single-line structured log so it's grep-friendly in Vercel's UI.
  console.error(
    `[client-error] kind=${payload.kind ?? "unknown"} url=${payload.url ?? "?"} msg=${JSON.stringify(payload.message)}${payload.stack ? ` stack=${JSON.stringify(payload.stack.slice(0, 2000))}` : ""}`,
  );

  return NextResponse.json({ ok: true });
}
