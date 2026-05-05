"use client";

import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";

const FAVORITES_KEY = "nod:favorites:v1";
const PLANNER_KEY = "nod:planner:v1";

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
  hydrated: boolean;
  isFavorite: (slug: string) => boolean;
  toggleFavorite: (slug: string) => void;
  plannerQuantity: (slug: string) => number;
  setPlannerQuantity: (slug: string, qty: number) => void;
  removeFromPlanner: (slug: string) => void;
  clearPlanner: () => void;
}

const StorageContext = createContext<StorageState | null>(null);

function safeLoad<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeSave(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // quota or disabled — silently ignore
  }
}

export function StorageProvider({ children }: { children: ReactNode }) {
  const [favorites, setFavorites] = useState<FavoriteEntry[]>([]);
  const [planner, setPlanner] = useState<PlannerEntry[]>([]);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate once on mount
  useEffect(() => {
    setFavorites(safeLoad<FavoriteEntry[]>(FAVORITES_KEY, []));
    setPlanner(safeLoad<PlannerEntry[]>(PLANNER_KEY, []));
    setHydrated(true);
  }, []);

  // Persist on change (after hydration)
  useEffect(() => {
    if (hydrated) safeSave(FAVORITES_KEY, favorites);
  }, [favorites, hydrated]);

  useEffect(() => {
    if (hydrated) safeSave(PLANNER_KEY, planner);
  }, [planner, hydrated]);

  const isFavorite = useCallback(
    (slug: string) => favorites.some((f) => f.slug === slug),
    [favorites],
  );

  const toggleFavorite = useCallback((slug: string) => {
    setFavorites((curr) => {
      const exists = curr.some((f) => f.slug === slug);
      if (exists) return curr.filter((f) => f.slug !== slug);
      return [...curr, { slug, addedAt: new Date().toISOString() }];
    });
  }, []);

  const plannerQuantity = useCallback(
    (slug: string) => planner.find((p) => p.slug === slug)?.quantity ?? 0,
    [planner],
  );

  const setPlannerQuantity = useCallback((slug: string, qty: number) => {
    setPlanner((curr) => {
      if (qty <= 0) return curr.filter((p) => p.slug !== slug);
      const existing = curr.find((p) => p.slug === slug);
      if (existing) {
        return curr.map((p) => (p.slug === slug ? { ...p, quantity: qty } : p));
      }
      return [...curr, { slug, quantity: qty }];
    });
  }, []);

  const removeFromPlanner = useCallback((slug: string) => {
    setPlanner((curr) => curr.filter((p) => p.slug !== slug));
  }, []);

  const clearPlanner = useCallback(() => setPlanner([]), []);

  return (
    <StorageContext.Provider
      value={{
        favorites,
        planner,
        hydrated,
        isFavorite,
        toggleFavorite,
        plannerQuantity,
        setPlannerQuantity,
        removeFromPlanner,
        clearPlanner,
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
