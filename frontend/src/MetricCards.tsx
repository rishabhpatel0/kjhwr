import type { Coverage, Metrics } from "../api";

const mw = (v?: number) => (v === undefined ? "–" : `${Math.round(v).toLocaleString()} MW`);

export default function MetricCards({ m, c }: { m: Metrics; c: Coverage }) {
  const cards = [
    { label: "MAE", value: mw(m.mae), hint: "Average miss" },
    { label: "RMSE", value: mw(m.rmse), hint: "Penalises big misses" },
    { label: "Bias", value: mw(m.bias), hint: "+ over-forecast, − under-forecast" },
    { label: "P90 error", value: mw(m.p90_abs), hint: "9 in 10 half-hours are within this" },
    { label: "P99 error", value: mw(m.p99_abs), hint: "Worst-case planning" },
    {
      label: "Coverage",
      value: `${c.matched} / ${c.actualTargets}`,
      hint: `${c.missing} half-hours had no usable forecast`,
    },
  ];
  return (
    <div className="cards">
      {cards.map((x) => (
        <div className="card" key={x.label}>
          <div className="card-label">{x.label}</div>
          <div className="card-value">{x.value}</div>
          <div className="card-hint">{x.hint}</div>
        </div>
      ))}
    </div>
  );
}