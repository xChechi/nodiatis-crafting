import { ImageResponse } from "@vercel/og";
import { findCategoryBySlug } from "@/lib/categories";
import { allItems } from "@/lib/data";

export const runtime = "nodejs";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ slug: string }> },
) {
  const { slug } = await ctx.params;
  const cat = findCategoryBySlug(slug);
  if (!cat) {
    return new Response("Not found", { status: 404 });
  }

  const count = allItems().filter((i) => cat.matches(i.Type)).length;

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
            "radial-gradient(ellipse at top right, rgba(212, 168, 90, 0.18), transparent 60%), radial-gradient(ellipse at bottom left, rgba(91, 163, 216, 0.10), transparent 60%)",
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
          Nodiatis Wiki — Category
        </div>
        <div
          style={{
            fontSize: 110,
            fontWeight: 600,
            lineHeight: 1.05,
            marginBottom: 32,
            color: "#e8eef5",
            display: "flex",
          }}
        >
          {cat.label}
        </div>
        <div
          style={{
            fontSize: 32,
            color: "#a4b1c2",
            display: "flex",
            gap: 24,
            alignItems: "center",
          }}
        >
          <span style={{ color: "#d4a85a" }}>
            {count.toLocaleString("en-US")}
          </span>
          <span>items</span>
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
