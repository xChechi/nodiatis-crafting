/**
 * Inline mini sparkline for the rolling MarketHistory cache (up to 3 points).
 * Newest value is on the RIGHT (chronological reading order).
 *
 * Visual language mirrors TierCostSparkline: gold stroke on bg-2.
 */
interface MarketSparklineProps {
  /** Newest-first array of up to 3 ask prices, as stored on Item.MarketHistory. */
  history: number[] | undefined;
  width?: number;
  height?: number;
}

const DEFAULT_W = 64;
const DEFAULT_H = 20;
const PAD = 2;

export function MarketSparkline({
  history,
  width = DEFAULT_W,
  height = DEFAULT_H,
}: MarketSparklineProps) {
  if (!history || history.length === 0) {
    return <span className="text-[var(--color-fg-3)] font-mono text-xs">—</span>;
  }

  // Reverse to plot oldest-on-left, newest-on-right.
  const series = [...history].reverse();
  const min = Math.min(...series);
  const max = Math.max(...series);
  const span = Math.max(1, max - min);

  const xStep = series.length === 1 ? 0 : (width - PAD * 2) / (series.length - 1);
  const points = series.map((v, i) => {
    const x = PAD + xStep * i;
    const y = height - PAD - ((v - min) / span) * (height - PAD * 2);
    return { x, y };
  });

  const polyline = points.map((p) => `${p.x},${p.y}`).join(" ");
  const last = points[points.length - 1];
  const trendUp = series.length >= 2 && series[series.length - 1] > series[0];
  const trendColor = trendUp
    ? "var(--color-rose)"
    : series.length >= 2 && series[series.length - 1] < series[0]
      ? "var(--color-emerald)"
      : "var(--color-gold)";

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role="img"
      aria-label={`Last ${series.length} market reading${series.length === 1 ? "" : "s"}: ${series.join(", ")} gold`}
      className="inline-block align-middle"
    >
      {series.length === 1 ? (
        <circle cx={width / 2} cy={height / 2} r={2} fill={trendColor} />
      ) : (
        <polyline
          points={polyline}
          fill="none"
          stroke={trendColor}
          strokeWidth={1.25}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      )}
      {series.length >= 2 && (
        <circle cx={last.x} cy={last.y} r={1.75} fill={trendColor} />
      )}
    </svg>
  );
}
