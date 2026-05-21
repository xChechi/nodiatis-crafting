import type { PriceReading } from "@/lib/marketHistory";

interface MarketHistoryChartProps {
  /** Newest-first as returned by getHistoryForSlug. */
  readings: PriceReading[];
}

const WIDTH = 560;
const HEIGHT = 180;
const PAD_X = 40;
const PAD_Y = 20;

export function MarketHistoryChart({ readings }: MarketHistoryChartProps) {
  if (readings.length === 0) {
    return (
      <div className="text-sm text-[var(--color-fg-3)] italic">
        No market data captured yet.
      </div>
    );
  }

  // Oldest on the left.
  const series = [...readings].reverse();
  const prices = series.map((r) => r.ask);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const span = Math.max(1, max - min);

  const xStep =
    series.length === 1 ? 0 : (WIDTH - PAD_X * 2) / (series.length - 1);

  const points = series.map((r, i) => {
    const x = PAD_X + xStep * i;
    const y = HEIGHT - PAD_Y - ((r.ask - min) / span) * (HEIGHT - PAD_Y * 2);
    return { x, y, ...r };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");

  return (
    <div className="bg-[var(--color-bg-2)] border border-[var(--color-border)] rounded-md p-3">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        role="img"
        aria-label={`Price history with ${series.length} reading${series.length === 1 ? "" : "s"}`}
      >
        {/* y-axis labels */}
        <text x={4} y={PAD_Y + 4} fontSize={10} fill="var(--color-fg-3)">
          {max.toLocaleString("en-US")}
        </text>
        <text x={4} y={HEIGHT - PAD_Y + 4} fontSize={10} fill="var(--color-fg-3)">
          {min.toLocaleString("en-US")}
        </text>
        {/* line */}
        {series.length === 1 ? (
          <circle cx={WIDTH / 2} cy={HEIGHT / 2} r={3} fill="var(--color-gold)" />
        ) : (
          <polyline
            points={polyline}
            fill="none"
            stroke="var(--color-gold)"
            strokeWidth={1.5}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        )}
        {/* points + month labels */}
        {points.map((p, i) => (
          <g key={p.month}>
            <circle cx={p.x} cy={p.y} r={2.5} fill="var(--color-gold)">
              <title>{`${p.month}: ${p.ask.toLocaleString("en-US")}g`}</title>
            </circle>
            {(i === 0 || i === points.length - 1) && (
              <text
                x={p.x}
                y={HEIGHT - 4}
                fontSize={10}
                fill="var(--color-fg-3)"
                textAnchor={i === 0 ? "start" : "end"}
              >
                {p.month}
              </text>
            )}
          </g>
        ))}
      </svg>
    </div>
  );
}
