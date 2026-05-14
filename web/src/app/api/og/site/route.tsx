import { ImageResponse } from "@vercel/og";
import { TOTAL_ITEMS, TOTAL_RECIPES } from "@/lib/counts";

export const runtime = "nodejs";

export async function GET() {
  const itemCount = TOTAL_ITEMS;
  const recipeCount = TOTAL_RECIPES;

  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0d12",
          backgroundImage:
            "radial-gradient(ellipse at top right, rgba(212, 168, 90, 0.20), transparent 60%), radial-gradient(ellipse at bottom left, rgba(91, 163, 216, 0.12), transparent 60%)",
          padding: 80,
          color: "#e8eef5",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            fontSize: 22,
            letterSpacing: 8,
            textTransform: "uppercase",
            color: "#d4a85a",
            marginBottom: 28,
          }}
        >
          Nodiatis Wiki
        </div>
        <div
          style={{
            fontSize: 110,
            fontWeight: 600,
            lineHeight: 1.05,
            color: "#e8eef5",
            display: "flex",
            marginBottom: 28,
          }}
        >
          Browse, craft, and plan
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#a4b1c2",
            lineHeight: 1.4,
            display: "flex",
            flexWrap: "wrap",
            gap: 16,
          }}
        >
          <span style={{ color: "#d4a85a" }}>
            {itemCount.toLocaleString("en-US")} items
          </span>
          <span>·</span>
          <span style={{ color: "#d4a85a" }}>
            {recipeCount.toLocaleString("en-US")} recipes
          </span>
          <span>·</span>
          <span>aggregated planner</span>
        </div>
        <div
          style={{
            marginTop: "auto",
            fontSize: 22,
            color: "#6b7889",
            fontFamily: "monospace",
            display: "flex",
          }}
        >
          nodiatis-crafting.vercel.app
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
