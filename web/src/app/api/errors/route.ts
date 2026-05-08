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

export async function POST(request: Request) {
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
