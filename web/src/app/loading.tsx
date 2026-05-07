import { Sparkles } from "lucide-react";

export default function RootLoading() {
  return (
    <div className="max-w-7xl mx-auto px-6 py-24 text-center">
      <div className="inline-flex items-center justify-center w-12 h-12 mb-4 rounded-full bg-[var(--color-bg-2)] border border-[var(--color-border)] animate-pulse">
        <Sparkles size={20} className="text-[var(--color-gold-soft)]" />
      </div>
      <p className="font-mono text-[11px] tracking-[0.4em] uppercase text-[var(--color-fg-3)]">
        Loading…
      </p>
    </div>
  );
}
