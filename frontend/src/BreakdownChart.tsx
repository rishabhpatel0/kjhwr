import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { BreakdownRow } from "../api";

interface Props {
  rows: BreakdownRow[];
  by: "horizon" | "hour";
  onBy: (b: "horizon" | "hour") => void;
}

export default function BreakdownChart({ rows, by, onBy }: Props) {
  const data = rows.map((r) => ({
    bucket: by === "horizon" ? `${r.bucket}–${r.bucket + 3}h` : `${String(r.bucket).padStart(2, "0")}:00`,
    MAE: Math.round(r.mae ?? 0),
    P90: Math.round(r.p90_abs ?? 0),
  }));

  return (
    <div>
      <div className="toggle">
        <button className={by === "horizon" ? "active" : ""} onClick={() => onBy("horizon")}>
          By forecast horizon
        </button>
        <button className={by === "hour" ? "active" : ""} onClick={() => onBy("hour")}>
          By hour of day (UTC)
        </button>
      </div>
      <ResponsiveContainer width="100%" height={320}>
        <BarChart data={data} margin={{ top: 24, right: 20, left: 10, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="bucket" />
          <YAxis
            width={80}
            allowDecimals={false}
            tickFormatter={(v) => Number(v).toLocaleString()}
            label={{ value: "Absolute error (MW)", angle: -90, position: "insideLeft", offset: -4 }}
          />
          <Tooltip formatter={(v) => `${Number(v).toLocaleString()} MW`} />
          <Legend />
          <Bar dataKey="MAE" fill="#2563eb" isAnimationActive={false} />
          <Bar dataKey="P90" fill="#f59e0b" isAnimationActive={false} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}