"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";

const THEME_KEY = "nod:theme:v1";
type Theme = "dark" | "light";
const DEFAULT_THEME: Theme = "dark";

function readTheme(): Theme {
  if (typeof window === "undefined") return DEFAULT_THEME;
  try {
    const v = window.localStorage.getItem(THEME_KEY);
    return v === "light" || v === "dark" ? v : DEFAULT_THEME;
  } catch {
    return DEFAULT_THEME;
  }
}

function applyTheme(t: Theme) {
  if (typeof document === "undefined") return;
  if (t === "light") document.documentElement.setAttribute("data-theme", "light");
  else document.documentElement.removeAttribute("data-theme");
}

export function ThemeToggle() {
  // Avoid hydration mismatch: render the dark icon on first paint, then sync
  // to the actual theme after mount.
  const [theme, setTheme] = useState<Theme>(DEFAULT_THEME);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    // One-shot post-hydration sync: the no-flash inline script in layout.tsx
    // already set the data-theme attribute; here we mirror that into React
    // state so the toggle button shows the right icon. Cascade-render warning
    // doesn't apply — this only runs once.
    const t = readTheme();
    /* eslint-disable react-hooks/set-state-in-effect */
    setTheme(t);
    setMounted(true);
    /* eslint-enable react-hooks/set-state-in-effect */
    applyTheme(t);
  }, []);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyTheme(next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* quota or disabled — silent */
    }
  }

  const Icon = theme === "dark" ? Sun : Moon;
  const label = theme === "dark" ? "Switch to parchment theme" : "Switch to dark theme";

  return (
    <button
      onClick={toggle}
      aria-label={label}
      title={label}
      className="flex items-center justify-center w-8 h-8 rounded-md text-[var(--color-fg-2)] hover:text-[var(--color-gold)] hover:bg-[var(--color-bg-2)] transition-colors"
    >
      {mounted && <Icon size={15} />}
    </button>
  );
}
