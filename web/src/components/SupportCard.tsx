import { Heart, Coffee } from "lucide-react";

// Lightweight support pitch shown next to the feedback form on the homepage.
// The CTA button is currently a no-op placeholder — wire it up to a
// Buy Me a Coffee / Ko-fi / GitHub Sponsors URL when one exists.
export function SupportCard() {
  return (
    <div className="relative bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-lg p-5 lg:p-6 flex flex-col">
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
          This wiki is a one-person side project — built on evenings and
          weekends because the existing tool drove me crazy. Hosting is free.
          Recipes don&apos;t change. What it costs is time — hours that could
          have gone almost anywhere else.
        </p>
        <p>
          I&apos;ve played Nodiatis for years — this site is a small love
          letter to a game that&apos;s quietly stayed with me. If there&apos;s
          real interest, the next thing I&apos;d love to build is a mobile
          companion app: planner, search, recipes, all in your pocket.
          Honestly, it comes down to time — between work, family, and other
          side projects fighting for the same evenings, this one needs a
          reason to jump the queue.
        </p>
        <p>
          If you&apos;d like to acknowledge the work, there&apos;s a tip
          option below. The site stays the same either way — it&apos;s
          entirely optional.
        </p>
        <p className="text-[var(--color-fg-3)]">
          No data is sold, no ads will ever appear here.
        </p>
      </div>

      <div className="mt-auto pt-5">
        <a
          href="https://buymeacoffee.com/sirenal"
          target="_blank"
          rel="noopener noreferrer"
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 px-4 py-2 text-sm bg-[var(--color-bg-3)] border border-[var(--color-gold-soft)] rounded text-[var(--color-gold)] hover:bg-[var(--color-bg-2)] hover:border-[var(--color-gold)] transition-colors"
        >
          <Coffee size={14} />
          Buy me a coffee
        </a>
      </div>

      <img
        src="/Chechi.png"
        alt=""
        width={127}
        height={126}
        aria-hidden="true"
        className="hidden sm:block absolute bottom-4 right-4 pointer-events-none select-none rounded-md border border-[var(--color-gold-soft)] shadow-[0_2px_8px_rgba(0,0,0,0.35)]"
      />
    </div>
  );
}
