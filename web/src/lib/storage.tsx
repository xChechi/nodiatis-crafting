"use client";

import {
  createContext,
  useCallback,
  useContext,
  useSyncExternalStore,
  type ReactNode,
} from "react";

const FAVORITES_KEY = "nod:favorites:v1";
const PLANNER_KEY = "nod:planner:v1";
const RECENT_KEY = "nod:recent:v1";
const RECENT_MAX = 10;

interface FavoriteEntry {
  slug: string;
  addedAt: string; // ISO
}

interface PlannerEntry {
  slug: string;
  quantity: number;
}

interface StorageState {
  favorites: FavoriteEntry[];
  planner: PlannerEntry[];
  recent: string[];
  hydrated: boolean;
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string) => void;
  plannerQuantity: (slug: string) => number;
  setPlannerQuantity: (slug: string, qty: number) => void;
  removeFromPlanner: (slug: string) => void;
  clearPlanner: () => void;
  /** Replace the entire planner — used when importing a shared URL. */
  replacePlanner: (entries: PlannerEntry[]) => void;
  /** Push a slug to the front of the recently-viewed list (deduped, capped). */
  pushRecent: (slug: string) => void;
}

const StorageContext = createContext<StorageState | null>(null);

// ─── External store (localStorage) ──────────────────────────────────────────
// Using useSyncExternalStore is React's canonical pattern for syncing with
// browser APIs without triggering set-state-in-effect lint warnings.

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  // Cross-tab sync via the storage event
  const onStorage = (e: StorageEvent) => {
    if (e.key === FAVORITES_KEY || e.key === PLANNER_KEY) cb();
  };
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", onStorage);
  };
}
function notify() {
  for (const cb of listeners) cb();
}

// Cached snapshots so getSnapshot is referentially stable between writes.
// Without this, useSyncExternalStore would loop (new array every read).
let favoritesCache: FavoriteEntry[] = [];
let plannerCache: PlannerEntry[] = [];
let recentCache: string[] = [];
let cacheLoaded = false;

function ensureLoaded() {
  if (cacheLoaded || typeof window === "undefined") return;
  cacheLoaded = true;
  try {
    const fav = window.localStorage.getItem(FAVORITES_KEY);
    if (fav) favoritesCache = JSON.parse(fav);
  } catch {
    /* corrupt or disabled — keep defaults */
  }
  try {
    const pl = window.localStorage.getItem(PLANNER_KEY);
    if (pl) plannerCache = JSON.parse(pl);
  } catch {
    /* corrupt or disabled — keep defaults */
  }
  try {
    const rc = window.localStorage.getItem(RECENT_KEY);
    if (rc) recentCache = JSON.parse(rc);
  } catch {
    /* corrupt or disabled — keep defaults */
  }
}

function getFavoritesSnapshot(): FavoriteEntry[] {
  ensureLoaded();
  return favoritesCache;
}
function getPlannerSnapshot(): PlannerEntry[] {
  ensureLoaded();
  return plannerCache;
}
function getRecentSnapshot(): string[] {
  ensureLoaded();
  return recentCache;
}

// Server snapshot is stable empty (matches initial client render before hydration).
const EMPTY_FAV: FavoriteEntry[] = [];
const EMPTY_PLAN: PlannerEntry[] = [];
const EMPTY_RECENT: string[] = [];
const getServerFavorites = () => EMPTY_FAV;
const getServerPlanner = () => EMPTY_PLAN;
const getServerRecent = () => EMPTY_RECENT;

function writeFavorites(next: FavoriteEntry[]) {
  favoritesCache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(next));
    } catch {
      /* quota or disabled — silent */
    }
  }
  notify();
}
function writePlanner(next: PlannerEntry[]) {
  plannerCache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(PLANNER_KEY, JSON.stringify(next));
    } catch {
      /* quota or disabled — silent */
    }
  }
  notify();
}
function writeRecent(next: string[]) {
  recentCache = next;
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
    } catch {
      /* quota or disabled — silent */
    }
  }
  notify();
}

// ─── Provider ────────────────────────────────────────────────────────────────

export function StorageProvider({ children }: { children: ReactNode }) {
  const favorites = useSyncExternalStore(
    subscribe,
    getFavoritesSnapshot,
    getServerFavorites,
  );
  const planner = useSyncExternalStore(
    subscribe,
    getPlannerSnapshot,
    getServerPlanner,
  );
  const recent = useSyncExternalStore(
    subscribe,
    getRecentSnapshot,
    getServerRecent,
  );

  // `hydrated` is true once the client has read localStorage at least once.
  // useSyncExternalStore returns the server snapshot during SSR and the first
  // client render — after that, getSnapshot runs and we're hydrated.
  const hydrated = typeof window !== "undefined" && cacheLoaded;

  const isFavorite = useCallback(
    (slug: string) => favorites.some((f) => f.slug === slug),
    [favorites],
  );

  const toggleFavorite = useCallback((slug: string) => {
    const exists = favoritesCache.some((f) => f.slug === slug);
    writeFavorites(
      exists
        ? favoritesCache.filter((f) => f.slug !== slug)
        : [...favoritesCache, { slug, addedAt: new Date().toISOString() }],
    );
  }, []);

  const plannerQuantity = useCallback(
    (slug: string) => planner.find((p) => p.slug === slug)?.quantity ?? 0,
    [planner],
  );

  const setPlannerQuantity = useCallback((slug: string, qty: number) => {
    if (qty <= 0) {
      writePlanner(plannerCache.filter((p) => p.slug !== slug));
      return;
    }
    const existing = plannerCache.find((p) => p.slug === slug);
    writePlanner(
      existing
        ? plannerCache.map((p) => (p.slug === slug ? { ...p, quantity: qty } : p))
        : [...plannerCache, { slug, quantity: qty }],
    );
  }, []);

  const removeFromPlanner = useCallback((slug: string) => {
    writePlanner(plannerCache.filter((p) => p.slug !== slug));
  }, []);

  const clearPlanner = useCallback(() => writePlanner([]), []);

  const replacePlanner = useCallback((entries: PlannerEntry[]) => {
    writePlanner(entries);
  }, []);

  const pushRecent = useCallback((slug: string) => {
    // Move slug to the front, dedupe, cap at RECENT_MAX
    const next = [slug, ...recentCache.filter((s) => s !== slug)].slice(
      0,
      RECENT_MAX,
    );
    writeRecent(next);
  }, []);

  return (
    <StorageContext.Provider
      value={{
        favorites,
        planner,
        recent,
        hydrated,
        isFavorite,
        toggleFavorite,
        plannerQuantity,
        setPlannerQuantity,
        removeFromPlanner,
        clearPlanner,
        replacePlanner,
        pushRecent,
      }}
    >
      {children}
    </StorageContext.Provider>
  );
}

export function useStorage(): StorageState {
  const ctx = useContext(StorageContext);
  if (!ctx) throw new Error("useStorage must be used inside <StorageProvider>");
  return ctx;
}
