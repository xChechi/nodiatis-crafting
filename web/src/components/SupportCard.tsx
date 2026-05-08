import { Heart, Coffee } from "lucide-react";

// Lightweight support pitch shown next to the feedback form on the homepage.
// The CTA button is currently a no-op placeholder — wire it up to a
// Buy Me a Coffee / Ko-fi / GitHub Sponsors URL when one exists.
export function SupportCard() {
  return (
    <div className="bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-lg p-5 lg:p-6 flex flex-col">
      <div className="flex items-center gap-2 mb-3">
        <Heart
          size={16}
          className="text-[var(--color-rust)]"
          fill="currentColor"
        />
        <h3 className="font-[family-name:var(--font-display-loaded)] text-lg lg:text-xl text-[var(--color-fg-1)]">
          Like the site? Help keep it growing
        </h3>
      </div>

      <div className="text-xs lg:text-sm text-[var(--color-fg-2)] leading-relaxed space-y-3">
        <p>
          This wiki is a one-person side project, built in evenings and
          weekends because the existing tool drove me crazy. Hosting, image
          storage, and the time to keep recipes accurate isn&apos;t free.
        </p>
        <p>
          If a planner saved you from scrolling that 6,000-row table, or you
          finally found a recipe you couldn&apos;t before, consider chipping in
          a coffee&apos;s worth. It&apos;s the difference between &quot;I&apos;ll get to
          it next month&quot; and &quot;let me ship that bug fix tonight.&quot;
        </p>
        <p className="text-[var(--color-fg-3)]">
          No data is sold, no ads will ever appear here.
        </p>
      </div>

      <div className="mt-auto pt-5">
        <button
          type="button"
          disabled
          title="Coming soon — Buy Me a Coffee / Ko-fi link will land here"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-[var(--color-bg-3)] border border-[var(--color-gold-soft)] rounded text-[var(--color-gold)] opacity-60 cursor-not-allowed"
        >
          <Coffee size={14} />
          Buy me a coffee — coming soon
        </button>
      </div>
    </div>
  );
}
