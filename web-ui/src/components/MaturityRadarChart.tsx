/**
 * SVG spider / radar chart for Gartner-aligned maturity dimensions (levels 1–5).
 */

export interface RadarSeries {
  id: string;
  label: string;
  levels: number[];
  color?: string;
  dashed?: boolean;
}

interface MaturityRadarChartProps {
  axisLabels: string[];
  series: RadarSeries[];
  maxLevel?: number;
  size?: number;
  className?: string;
}

function polar(cx: number, cy: number, radius: number, angleRad: number) {
  return {
    x: cx + radius * Math.cos(angleRad),
    y: cy + radius * Math.sin(angleRad),
  };
}

function polygonPoints(
  cx: number,
  cy: number,
  radius: number,
  levels: number[],
  maxLevel: number,
  count: number,
) {
  return levels
    .slice(0, count)
    .map((level, i) => {
      const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
      const r = radius * (Math.max(0, Math.min(level, maxLevel)) / maxLevel);
      const { x, y } = polar(cx, cy, r, angle);
      return `${x},${y}`;
    })
    .join(" ");
}

export function MaturityRadarChart({
  axisLabels,
  series,
  maxLevel = 5,
  size = 340,
  className = "",
}: MaturityRadarChartProps) {
  const count = axisLabels.length;
  const cx = size / 2;
  const cy = size / 2;
  const radius = size * 0.34;
  const labelRadius = radius + 28;

  const gridLevels = [1, 2, 3, 4, 5];

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      className={`mx-auto w-full max-w-md ${className}`}
      role="img"
      aria-label="Data maturity radar chart"
    >
      {/* Grid rings */}
      {gridLevels.map((level) => (
        <polygon
          key={level}
          points={polygonPoints(cx, cy, radius, gridLevels.map(() => level), maxLevel, count)}
          fill="none"
          stroke="currentColor"
          strokeOpacity={level === maxLevel ? 0.25 : 0.12}
          className="text-slate-400"
        />
      ))}

      {/* Axis spokes */}
      {axisLabels.map((_, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
        const outer = polar(cx, cy, radius, angle);
        return (
          <line
            key={`spoke-${i}`}
            x1={cx}
            y1={cy}
            x2={outer.x}
            y2={outer.y}
            stroke="currentColor"
            strokeOpacity={0.15}
            className="text-slate-400"
          />
        );
      })}

      {/* Level ring labels */}
      {gridLevels.map((level) => {
        const { y } = polar(cx, cy, radius * (level / maxLevel), -Math.PI / 2);
        return (
          <text
            key={`ring-${level}`}
            x={cx + 4}
            y={y + 3}
            className="fill-slate-400 text-[9px]"
          >
            {level}
          </text>
        );
      })}

      {/* Data series */}
      {series.map((s) => (
        <polygon
          key={s.id}
          points={polygonPoints(cx, cy, radius, s.levels, maxLevel, count)}
          fill={s.color ?? "#6366f1"}
          fillOpacity={s.dashed ? 0.08 : 0.22}
          stroke={s.color ?? "#6366f1"}
          strokeWidth={s.dashed ? 1.5 : 2}
          strokeDasharray={s.dashed ? "6 4" : undefined}
          strokeOpacity={s.dashed ? 0.55 : 0.85}
        />
      ))}

      {/* Axis labels */}
      {axisLabels.map((label, i) => {
        const angle = -Math.PI / 2 + (2 * Math.PI * i) / count;
        const { x, y } = polar(cx, cy, labelRadius, angle);
        const anchor =
          Math.abs(Math.cos(angle)) < 0.15 ? "middle" : Math.cos(angle) > 0 ? "start" : "end";
        const words = label.split(" ");
        const line1 = words.slice(0, Math.ceil(words.length / 2)).join(" ");
        const line2 = words.slice(Math.ceil(words.length / 2)).join(" ");
        return (
          <text
            key={`label-${i}`}
            x={x}
            y={y}
            textAnchor={anchor}
            dominantBaseline="middle"
            className="fill-slate-600 text-[9px] font-medium dark:fill-slate-300"
          >
            <tspan x={x} dy={line2 ? -5 : 0}>
              {line1}
            </tspan>
            {line2 && (
              <tspan x={x} dy={11}>
                {line2}
              </tspan>
            )}
          </text>
        );
      })}
    </svg>
  );
}
