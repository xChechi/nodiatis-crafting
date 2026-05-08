"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Heart, Share2, RotateCcw, X } from "lucide-react";
import { useStorage } from "@/lib/storage";
import { useToast } from "@/lib/toast";
import { getIndexedItemBySlug, type IndexedItem } from "@/lib/clientIndex";
import { ItemCard } from "@/components/ItemCard";

const URL_PARAM = "f";

/** Decode `slug-1,slug-2`. Skips unknown slugs. */
function decodeFavorites(encoded: string): string[] {
  if (!encoded) return [];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const slug of encoded.split(",")) {
    const trimmed = slug.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    if (!getIndexedItemBySlug(trimmed)) continue;
    seen.add(trimmed);
    out.push(trimmed);
  }
  return out;
}

export function FavoritesClient() {
  const { favorites, hydrated, replaceFavorites } = useStorage();
  const toast = useToast();
  const router = useRouter();
  const searchParams = useSearchParams();
  const importHandledRef = useRef(false);
  const [importBackup, setImportBackup] = useState<string[] | null>(null);

  // ─── Import from URL on first mount ──────────────────────────────────────
  useEffect(() => {
    if (!hydrated || importHandledRef.current) return;
    const encoded = searchParams.get(URL_PARAM);
    if (!encoded) {
      importHandledRef.current = true;
      return;
    }
    const incoming = decodeFavorites(encoded);
    if (incoming.length === 0) {
      const params = new URLSearchParams(searchParams.toString());
      params.delete(URL_PARAM);
      router.replace(
        params.toString() ? `?${params.toString()}` : "/favorites",
        { scroll: false },
      );
      importHandledRef.current = true;
      return;
    }
    const currentSlugs = favorites.map((f) => f.slug).sort();
    const incomingSorted = [...incoming].sort();
    const equal =
      currentSlugs.length === incomingSorted.length &&
      currentSlugs.every((s, i) => s === incomingSorted[i]);
    if (!equal) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setImportBackup(favorites.map((f) => f.slug));
      replaceFavorites(incoming);
    }
    importHandledRef.current = true;
  }, [hydrated, searchParams, favorites, replaceFavorites, router]);

  const items = favorites
    .map((f) => getIndexedItemBySlug(f.slug))
    .filter((x): x is IndexedItem => Boolean(x));

  function copyShareUrl() {
    if (typeof window === "undefined") return;
    const slugs = favorites.map((f) => f.slug).join(",");
    const url = slugs
      ? `${window.location.origin}/favorites?${URL_PARAM}=${encodeURIComponent(slugs)}`
      : `${window.location.origin}/favorites`;
    navigator.clipboard
      .writeText(url)
      .then(() => toast.push("success", "Share URL copied"))
      .catch(() => toast.push("error", "Couldn't copy"));
  }

  function undoImport() {
    if (importBackup === null) return;
    replaceFavorites(importBackup);
    setImportBackup(null);
    const params = new URLSearchParams(searchParams.toString());
    params.delete(URL_PARAM);
    router.replace(
      params.toString() ? `?${params.toString()}` : "/favorites",
      { scroll: false },
    );
  }

  function dismissImportBanner() {
    setImportBackup(null);
  }

  return (
    <div className="max-w-7xl mx-auto px-6 py-8">
      <header className="flex items-start justify-between gap-4 mb-8 flex-wrap">
        <div>
          <h1 className="font-[family-name:var(--font-display-loaded)] text-3xl text-[var(--color-fg-1)] mb-1 flex items-center gap-3">
            <Heart size={24} className="text-[var(--color-rust)]" fill="currentColor" />
            Favorites
          </h1>
          <p className="text-sm text-[var(--color-fg-3)] font-mono">
            {items.length} saved {items.length === 1 ? "item" : "items"}
          </p>
        </div>
        {items.length > 0 && (
          <button
            type="button"
            onClick={copyShareUrl}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded text-[var(--color-fg-2)] hover:border-[var(--color-gold-soft)] hover:text-[var(--color-gold)]"
            title="Copy a shareable link to this favorites list"
          >
            <Share2 size={13} />
            Share
          </button>
        )}
      </header>

      {importBackup !== null && (
        <div className="mb-6 flex items-center justify-between gap-3 p-3 bg-[var(--color-bg-2)] border border-[var(--color-gold-soft)]/40 rounded-md text-sm">
          <span className="text-[var(--color-fg-2)]">
            Imported a favorites list from a shared link.{" "}
            <span className="text-[var(--color-fg-3)]">
              Your previous list ({importBackup.length}{" "}
              {importBackup.length === 1 ? "item" : "items"}) was replaced.
            </span>
          </span>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={undoImport}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-[var(--color-bg-3)] border border-[var(--color-border)] rounded text-[var(--color-fg-1)] hover:border-[var(--color-gold-soft)]"
            >
              <RotateCcw size={11} />
              Restore mine
            </button>
            <button
              onClick={dismissImportBanner}
              className="text-[var(--color-fg-3)] hover:text-[var(--color-fg-1)]"
              title="Dismiss"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {!hydrated ? (
        <div className="text-center py-20 text-[var(--color-fg-3)]">Loading...</div>
      ) : items.length === 0 ? (
        <div className="text-center py-20">
          <p className="text-[var(--color-fg-2)] mb-2">No favorites yet.</p>
          <p className="text-sm text-[var(--color-fg-3)]">
            Click the ♥ on any item page to save it here.
          </p>
          <Link
            href="/"
            className="inline-block mt-4 text-sm text-[var(--color-gold)] hover:underline"
          >
            Browse items →
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-2">
          {items.map((item) => (
            <ItemCard key={item.slug} item={item} />
          ))}
        </div>
      )}
    </div>
  );
}
