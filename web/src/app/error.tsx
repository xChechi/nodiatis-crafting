"use client";

import { useEffect } from "react";
import Link from "next/link";
import { AlertTriangle, RotateCw } from "lucide-react";
import { reportError } from "@/lib/errorReporter";

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Route error:", error);
    reportError({
      message: error.message,
      stack: error.stack,
      kind: "render",
      source: error.digest,
    });
  }, [error]);

  return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-[var(--color-bg-2)] border border-[var(--color-rust)]/40">
        <AlertTriangle size={28} className="text-[var(--color-rust)]" />
      </div>
      <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-[var(--color-rust)] mb-3">
        Error
      </p>
      <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl md:text-4xl text-[var(--color-fg-1)] mb-3">
        Something went wrong
      </h1>
      <p className="text-[var(--color-fg-2)] mb-8 leading-relaxed">
        An unexpected error occurred while loading this page. Try again, or
        head back home.
      </p>
      {error.digest && (
        <p className="font-mono text-[10px] text-[var(--color-fg-3)] mb-6">
          Reference: {error.digest}
        </p>
      )}
      <div className="flex items-center justify-center gap-3">
        <button
          onClick={() => reset()}
          className="inline-flex items-center gap-2 px-4 py-2 text-sm bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded text-[var(--color-fg-1)] hover:border-[var(--color-gold-soft)]"
        >
          <RotateCw size={14} />
          Try again
        </button>
        <Link
          href="/"
          className="px-4 py-2 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-gold)]"
        >
          Home
        </Link>
      </div>
    </div>
  );
}
