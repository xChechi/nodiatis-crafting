import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Nodiatis Wiki & Crafting Calculator",
    short_name: "Nodiatis Wiki",
    description:
      "Browse Nodiatis items, view crafting recipes, save favorites, and plan crafting sessions.",
    start_url: "/",
    display: "standalone",
    background_color: "#0a0d12",
    theme_color: "#d4a85a",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
    ],
  };
}
