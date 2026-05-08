import { CraftableClient } from "./CraftableClient";

export const metadata = {
  title: "What can I craft?",
  description:
    "Paste your Nodiatis inventory and find every recipe you have enough mats to craft, ranked by coverage.",
  alternates: { canonical: "/craftable" },
};

export default function CraftablePage() {
  return <CraftableClient />;
}
