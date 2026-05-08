import type { Metadata } from "next";
import Link from "next/link";
import { Cinzel, Inter } from "next/font/google";
import "./globals.css";
import { StorageProvider } from "@/lib/storage";
import { ToastProvider } from "@/lib/toast";
import { TopNav } from "@/components/TopNav";
import { PageTransition } from "@/components/PageTransition";
import { ErrorReporterMount } from "@/components/ErrorReporterMount";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans-loaded" });
const cinzel = Cinzel({ subsets: ["latin"], variable: "--font-display-loaded" });

const SITE_URL = "https://nodiatis-crafting.vercel.app";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "Nodiatis Wiki & Crafting Calculator",
    template: "%s — Nodiatis Wiki",
  },
  description:
    "Browse all 5,488 Nodiatis items, view 2,211 crafting recipes, save favorites, and plan your crafting sessions with an aggregated shopping list.",
  keywords: [
    "Nodiatis",
    "Nodiatis crafting",
    "Nodiatis wiki",
    "Nodiatis recipes",
    "Nodiatis items",
    "Nodiatis tools",
    "MMORPG crafting",
  ],
  openGraph: {
    type: "website",
    siteName: "Nodiatis Wiki & Crafting",
    title: "Nodiatis Wiki & Crafting Calculator",
    description:
      "Browse 5,488 items, 2,211 recipes, save favorites and plan crafting sessions.",
  },
  robots: { index: true, follow: true },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${cinzel.variable} h-full antialiased`}
    >
      <head>
        {/*
          No-flash theme script: runs synchronously before hydration so a
          light-theme user doesn't see a dark flash on first paint. Plain
          string to avoid React serializing curly braces as text.
        */}
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('nod:theme:v1');if(t==='light')document.documentElement.setAttribute('data-theme','light');}catch(e){}",
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        <StorageProvider>
          <ToastProvider>
            <ErrorReporterMount />
            <TopNav />
            <main className="flex-1">
              <PageTransition>{children}</PageTransition>
            </main>
          <footer className="border-t border-[var(--color-border)] mt-16">
            <div className="max-w-7xl mx-auto px-6 py-8 flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-sm text-[var(--color-fg-3)]">
              <p>
                Data sourced from{" "}
                <a
                  href="https://tools.nodiatis.com/neo-items/"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-fg-2)] hover:text-[var(--color-gold)]"
                >
                  tools.nodiatis.com
                </a>
                . Not affiliated with Glitchless or Nodiatis.
              </p>
              <p>
                Built by Stefan Nasev ·{" "}
                <Link
                  href="/about"
                  className="text-[var(--color-fg-2)] hover:text-[var(--color-gold)]"
                >
                  About
                </Link>{" "}
                ·{" "}
                <a
                  href="https://github.com/xChechi/nodiatis-crafting"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[var(--color-fg-2)] hover:text-[var(--color-gold)]"
                >
                  GitHub
                </a>
              </p>
            </div>
          </footer>
          </ToastProvider>
        </StorageProvider>
      </body>
    </html>
  );
}
