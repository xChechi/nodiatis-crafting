import { NextResponse } from "next/server";

// Feedback sink. Posts from the homepage form land here. For now we log to
// Vercel runtime logs (single-line, grep-friendly); later this can fan out
// to Resend / Discord webhook / Supabase by changing only this handler.

export const runtime = "edge";

interface FeedbackPayload {
  message: string;
  email?: string;
}

const MAX_MESSAGE = 4000;

export async function POST(request: Request) {
  let payload: FeedbackPayload;
  try {
    const text = await request.text();
    if (text.length > MAX_MESSAGE + 1024) {
      return NextResponse.json({ ok: false, reason: "too-large" }, { status: 413 });
    }
    payload = JSON.parse(text) as FeedbackPayload;
  } catch {
    return NextResponse.json({ ok: false, reason: "bad-json" }, { status: 400 });
  }

  const message = (payload?.message ?? "").trim();
  if (!message || message.length < 4) {
    return NextResponse.json(
      { ok: false, reason: "missing-message" },
      { status: 400 },
    );
  }
  if (message.length > MAX_MESSAGE) {
    return NextResponse.json({ ok: false, reason: "too-long" }, { status: 413 });
  }

  const email = (payload?.email ?? "").trim().slice(0, 200);

  // Single-line log so it's easy to grep in the Vercel runtime view.
  console.log(
    `[feedback] email=${JSON.stringify(email || "(anon)")} msg=${JSON.stringify(message)}`,
  );

  return NextResponse.json({ ok: true });
}
