import Link from "next/link";
import { Compass } from "lucide-react";

export default function NotFound() {
  return (
    <div className="max-w-xl mx-auto px-6 py-24 text-center">
      <div className="inline-flex items-center justify-center w-16 h-16 mb-6 rounded-full bg-[var(--color-bg-2)] border border-[var(--color-border)]">
        <Compass size={28} className="text-[var(--color-gold-soft)]" />
      </div>
      <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-[var(--color-gold)] mb-3">
        404
      </p>
      <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl md:text-4xl text-[var(--color-fg-1)] mb-3">
        Page not found
      </h1>
      <p className="text-[var(--color-fg-2)] mb-8 leading-relaxed">
        The page you&apos;re looking for doesn&apos;t exist. It may have been moved,
        or the link might be wrong.
      </p>
      <div className="flex items-center justify-center gap-3">
        <Link
          href="/"
          className="px-4 py-2 text-sm bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded text-[var(--color-fg-1)] hover:border-[var(--color-gold-soft)]"
        >
          Home
        </Link>
        <Link
          href="/category/weapons"
          className="px-4 py-2 text-sm text-[var(--color-fg-3)] hover:text-[var(--color-gold)]"
        >
          Browse weapons →
        </Link>
      </div>
    </div>
  );
}
