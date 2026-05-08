// Inline SVG sparkline showing cost-per-unit across the tier range for a
// single material type. Pure server-renderable component — no client JS.

interface TierCostSparklineProps {
  /** [{ tier, cost }] sorted by tier asc. Tiers with no item / no cost are skipped. */
  points: Array<{ tier: number; cost: number }>;
  materialName: string;
}

const WIDTH = 240;
const HEIGHT = 40;
const PAD = 4;

export function TierCostSparkline({ points, materialName }: TierCostSparklineProps) {
  if (points.length < 2) return null;

  const tiers = points.map((p) => p.tier);
  const costs = points.map((p) => p.cost);
  const minTier = Math.min(...tiers);
  const maxTier = Math.max(...tiers);
  const minCost = Math.min(...costs);
  const maxCost = Math.max(...costs);
  const tierSpan = Math.max(1, maxTier - minTier);
  const costSpan = Math.max(1, maxCost - minCost);

  const xy = points.map((p) => {
    const x = PAD + ((p.tier - minTier) / tierSpan) * (WIDTH - PAD * 2);
    const y = HEIGHT - PAD - ((p.cost - minCost) / costSpan) * (HEIGHT - PAD * 2);
    return { x, y, ...p };
  });

  const path = xy.map((p, i) => `${i === 0 ? "M" : "L"}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");

  return (
    <div className="inline-flex items-center gap-3 px-3 py-2 bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md">
      <span className="text-[10px] uppercase tracking-wider text-[var(--color-fg-3)]">
        Cost · T{minTier}–T{maxTier}
      </span>
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        role="img"
        aria-label={`${materialName} unit cost from tier ${minTier} (${minCost} gold) to tier ${maxTier} (${maxCost} gold)`}
        className="overflow-visible"
      >
        <path
          d={path}
          fill="none"
          stroke="var(--color-gold)"
          strokeWidth="1.5"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        {xy.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r="1.5"
            fill="var(--color-gold)"
          >
            <title>
              T{p.tier}: {p.cost.toLocaleString("en-US")}g
            </title>
          </circle>
        ))}
      </svg>
      <span className="text-[10px] font-mono text-[var(--color-fg-3)]">
        {minCost.toLocaleString("en-US")}g → {maxCost.toLocaleString("en-US")}g
      </span>
    </div>
  );
}
