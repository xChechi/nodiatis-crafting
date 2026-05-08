"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

// Subtle fade-in on route change. CSS @keyframes (defined in globals.css as
// `pageFadeIn`) replaces framer-motion to avoid the ~50-100KB dep when all
// we need is a 180ms opacity+translate. Keying off pathname forces React to
// remount the wrapper on each route, which restarts the animation.
export function PageTransition({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div
      key={pathname}
      className="motion-safe:[animation:pageFadeIn_180ms_ease-out]"
    >
      {children}
    </div>
  );
}
