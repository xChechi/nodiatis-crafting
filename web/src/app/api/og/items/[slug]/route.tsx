import { ImageResponse } from "@vercel/og";
import { getItemBySlug } from "@/lib/data";

export const runtime = "nodejs"; // @vercel/og supports both edge and nodejs

const RARITY_COLORS: Record<string, string> = {
  Common: "#a4b1c2",
  Uncommon: "#4fbf85",
  Rare: "#5ba3d8",
  Epic: "#9070c4",
  Legendary: "#d4a85a",
};

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const item = getItemBySlug(slug);
  if (!item) {
    return new Response("Not found", { status: 404 });
  }

  const rarityColor = RARITY_COLORS[item.rarityLabel] ?? "#a4b1c2";

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
            "radial-gradient(ellipse at top right, rgba(212, 168, 90, 0.15), transparent 60%), radial-gradient(ellipse at bottom left, rgba(91, 163, 216, 0.10), transparent 60%)",
          padding: 60,
          color: "#e8eef5",
          fontFamily: "Georgia, serif",
        }}
      >
        <div
          style={{
            fontSize: 18,
            letterSpacing: 6,
            textTransform: "uppercase",
            color: "#d4a85a",
            marginBottom: 16,
          }}
        >
          Nodiatis Wiki
        </div>
        <div
          style={{
            fontSize: 22,
            color: rarityColor,
            marginBottom: 12,
            display: "flex",
            gap: 16,
          }}
        >
          <span>{item.rarityLabel}</span>
          <span style={{ color: "#6b7889" }}>·</span>
          <span style={{ color: "#a4b1c2" }}>{item.Type}</span>
        </div>
        <div
          style={{
            fontSize: 78,
            fontWeight: 600,
            lineHeight: 1.05,
            marginBottom: 24,
            color: "#e8eef5",
            display: "flex",
          }}
        >
          {item.Name}
        </div>
        {item.Description && (
          <div
            style={{
              fontSize: 24,
              color: "#a4b1c2",
              marginBottom: 24,
              fontStyle: "italic",
              maxWidth: "85%",
              display: "flex",
            }}
          >
            {item.Description.length > 120
              ? item.Description.slice(0, 117) + "…"
              : item.Description}
          </div>
        )}
        <div
          style={{
            marginTop: "auto",
            display: "flex",
            gap: 32,
            fontSize: 22,
            color: "#a4b1c2",
            fontFamily: "monospace",
          }}
        >
          {item.Level !== undefined && item.Level > 0 && (
            <span>
              <span style={{ color: "#6b7889" }}>Level </span>
              {item.Level}
            </span>
          )}
          {item.tier !== null && (
            <span>
              <span style={{ color: "#6b7889" }}>Tier </span>
              {item.tier}
            </span>
          )}
          {item.Cost !== undefined && item.Cost > 0 && (
            <span>
              <span style={{ color: "#6b7889" }}>Cost </span>
              {item.Cost.toLocaleString("en-US")}
            </span>
          )}
          {item.recipe && (
            <span style={{ color: "#4fbf85" }}>Craftable</span>
          )}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
