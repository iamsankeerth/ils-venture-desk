/** Tiny inline SVG data-ink: sparklines for verified readings, proportion bars for ledgers. */

export function Sparkline({ values, threshold, width = 120, height = 32, label }) {
  const nums = (values ?? []).filter((v) => typeof v === "number");
  if (nums.length < 2) return null;
  const max = Math.max(...nums, threshold ?? 0, 1);
  const min = Math.min(...nums, 0);
  const span = max - min || 1;
  const stepX = nums.length > 1 ? width / (nums.length - 1) : 0;
  const pts = nums.map((v, i) => `${(i * stepX).toFixed(1)},${(height - 3 - ((v - min) / span) * (height - 6)).toFixed(1)}`);
  const thrY = threshold == null ? null : (height - 3 - ((threshold - min) / span) * (height - 6)).toFixed(1);
  return (
    <svg
      width={width} height={height} viewBox={`0 0 ${width} ${height}`}
      role="img" aria-label={label ?? `Trend: ${nums.join(", ")}`}
      className="shrink-0 overflow-visible"
    >
      {thrY != null ? (
        <line x1="0" x2={width} y1={thrY} y2={thrY} stroke="#b91c1c" strokeWidth="1" strokeDasharray="3 2" opacity="0.7" />
      ) : null}
      <polyline points={pts.join(" ")} fill="none" stroke="#0f766e" strokeWidth="1.75" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => {
        const [cx, cy] = p.split(",");
        return <circle key={i} cx={cx} cy={cy} r="2.25" fill="#0f766e" />;
      })}
    </svg>
  );
}

export function ProportionBar({ parts, label }) {
  // parts: [{value, color, name}] — widths proportional to max.
  const max = Math.max(...parts.map((p) => p.value ?? 0), 1);
  return (
    <div role="img" aria-label={label} className="flex flex-col gap-1">
      {parts.map((p) => (
        <div key={p.name} className="flex items-center gap-2">
          <span className="w-20 shrink-0 truncate text-xs text-muted">{p.name}</span>
          <div className="h-2 min-w-0 flex-1 rounded-full bg-slate-100">
            <div className="h-2 rounded-full" style={{ width: `${((p.value ?? 0) / max) * 100}%`, backgroundColor: p.color }} />
          </div>
        </div>
      ))}
    </div>
  );
}
