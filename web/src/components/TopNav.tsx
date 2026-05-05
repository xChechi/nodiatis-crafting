"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Heart, Calculator, Search, Sparkles } from "lucide-react";
import { useStorage } from "@/lib/storage";
import { GlobalSearch } from "./GlobalSearch";

const navLinks = [
  { href: "/", label: "Home", icon: Home },
  { href: "/favorites", label: "Favorites", icon: Heart },
  { href: "/planner", label: "Planner", icon: Calculator },
];

export function TopNav() {
  const pathname = usePathname();
  const { favorites, planner, hydrated } = useStorage();

  return (
    <header className="sticky top-0 z-40 bg-[var(--color-bg-1)]/85 backdrop-blur-md border-b border-[var(--color-border)]">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center gap-6">
        <Link
          href="/"
          className="flex items-center gap-2 font-[family-name:var(--font-display-loaded)] text-[var(--color-gold)] text-lg tracking-wide hover:text-[var(--color-fg-1)] transition-colors"
        >
          <Sparkles size={18} className="opacity-80" />
          Nodiatis
        </Link>

        <nav className="hidden md:flex items-center gap-1">
          {navLinks.map(({ href, label, icon: Icon }) => {
            const active =
              pathname === href ||
              (href !== "/" && pathname.startsWith(href));
            const badge =
              href === "/favorites" && hydrated
                ? favorites.length
                : href === "/planner" && hydrated
                  ? planner.length
                  : 0;
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm transition-colors ${
                  active
                    ? "text-[var(--color-gold)] bg-[var(--color-bg-3)]"
                    : "text-[var(--color-fg-2)] hover:text-[var(--color-fg-1)] hover:bg-[var(--color-bg-2)]"
                }`}
              >
                <Icon size={14} />
                {label}
                {badge > 0 && (
                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-[var(--color-gold)] text-[var(--color-bg-1)] font-semibold">
                    {badge}
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        <div className="flex-1" />

        <GlobalSearch />
      </div>

      {/* Mobile nav strip */}
      <div className="md:hidden border-t border-[var(--color-border)] flex">
        {navLinks.map(({ href, label, icon: Icon }) => {
          const active =
            pathname === href ||
            (href !== "/" && pathname.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              className={`flex-1 flex flex-col items-center gap-1 py-2 text-[11px] ${
                active ? "text-[var(--color-gold)]" : "text-[var(--color-fg-2)]"
              }`}
            >
              <Icon size={16} />
              {label}
            </Link>
          );
        })}
      </div>
    </header>
  );
}
