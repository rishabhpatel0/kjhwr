import {
  Area,
  CartesianGrid,
  ComposedChart,
  Legend,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Point } from "./api";

const fmt = (iso: string) =>
  new Date(iso).toLocaleString("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });

export default function ForecastChart({ points }: { points: Point[] }) {
  const data = points.map((p) => ({
    t: p.startTime,
    actual: p.actual,
    forecast: p.forecast,
    band: [p.lower, p.upper] as [number, number],
  }));

  return (
    <ResponsiveContainer width="100%" height={380}>
      <ComposedChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="t" tickFormatter={fmt} minTickGap={60} />
        <YAxis tickFormatter={(v) => `${(Number(v) / 1000).toFixed(0)} GW`} />
        <Tooltip
          labelFormatter={(l) => fmt(String(l))}
          formatter={(v, name) =>
            Array.isArray(v)
              ? [`${Math.round(Number(v[0]))} – ${Math.round(Number(v[1]))} MW`, "P90 band"]
              : [`${Math.round(Number(v))} MW`, name]
          }
        />
        <Legend />
        <Area
          dataKey="band"
          name="Forecast ± P90 error"
          fill="#93c5fd"
          fillOpacity={0.35}
          stroke="none"
          isAnimationActive={false}
        />
        <Line
          dataKey="forecast"
          name="Forecast (known at decision time)"
          stroke="#2563eb"
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
        <Line
          dataKey="actual"
          name="Actual"
          stroke="#16a34a"
          dot={false}
          strokeWidth={2}
          isAnimationActive={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
