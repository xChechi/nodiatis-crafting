import { Suspense } from "react";
import { PlannerClient } from "./PlannerClient";

export const metadata = {
  title: "Planner",
  description:
    "Add Nodiatis items to a crafting planner and get a single aggregated shopping list of all base materials needed.",
};

export default function PlannerPage() {
  return (
    <Suspense>
      <PlannerClient />
    </Suspense>
  );
}
