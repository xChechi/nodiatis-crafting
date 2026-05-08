import { Suspense } from "react";
import { FavoritesClient } from "./FavoritesClient";

export const metadata = {
  title: "Favorites",
  description:
    "Your saved Nodiatis items. Click the share button to copy a URL that loads them on another browser.",
  alternates: { canonical: "/favorites" },
};

export default function FavoritesPage() {
  return (
    <Suspense>
      <FavoritesClient />
    </Suspense>
  );
}
