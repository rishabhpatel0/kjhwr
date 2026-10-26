import { useEffect, useState } from "react";
import {
  fetchBreakdown,
  fetchMetrics,
  fetchPoints,
  type BreakdownRow,
  type Coverage,
  type Metrics,
  type Point,
  type Query,
} from "./api";
import Controls from "./Controls";
import MetricCards from "./MetricCards";
import ForecastChart from "./ForecastChart";
import BreakdownChart from "./BreakdownChart";

const mw = (v: number) => Math.round(v).toLocaleString();

export default function App() {
  const [q, setQ] = useState<Query>({ start: "2026-01-01", end: "2026-01-31", decisionHour: 9 });
  const [by, setBy] = useState<"horizon" | "hour">("horizon");
  const [points, setPoints] = useState<Point[]>([]);
  const [metrics, setMetrics] = useState<Metrics>({ n: 0 });
  const [coverage, setCoverage] = useState<Coverage>({ actualTargets: 0, matched: 0, missing: 0 });
  const [rows, setRows] = useState<BreakdownRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!q.start || !q.end || q.start > q.end) return;
    let cancelled = false;
    setLoading(true);
    setError(null);
    Promise.all([fetchPoints(q), fetchMetrics(q), fetchBreakdown(q, by)])
      .then(([p, m, b]) => {
        if (cancelled) return;
        setPoints(p.points);
        setMetrics(m.metrics);
        setCoverage(m.coverage);
        setRows(b.rows);
      })
      .catch((e: Error) => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [q, by]);

  const invalidRange = q.start > q.end;
  const over = mw(metrics.p90_over ?? 0);
  const bias = metrics.bias ?? 0;

  return (
    <div className="page">
      <header>
        <h1>Wind Forecast Monitor</h1>
        <p>
          UK national wind generation: the forecast you actually had when buying day-ahead power,
          versus what happened.
        </p>
      </header>

      <Controls value={q} onChange={setQ} />

      {invalidRange && <div className="msg error">Start date must be before end date.</div>}
      {error && <div className="msg error">{error}</div>}
      {loading && <div className="msg">Loading…</div>}

      {!invalidRange && !error && metrics.n > 0 && (
        <>
          <div className="insight">
            <strong>Planning guide:</strong> with a {String(q.decisionHour).padStart(2, "0")}:00
            decision time, actual wind was at least <strong>forecast − {over} MW</strong> in 9 out of 10
            half-hours. For a conservative buy, plan for that figure. On average the forecast was{" "}
            <strong>{mw(Math.abs(bias))} MW too {bias >= 0 ? "high" : "low"}</strong> over this period.
          </div>

          <MetricCards m={metrics} c={coverage} />

          <section>
            <h2>Forecast vs actual</h2>
            <ForecastChart points={points} />
          </section>

          <section>
            <h2>Where the error comes from</h2>
            <BreakdownChart rows={rows} by={by} onBy={setBy} />
          </section>
        </>
      )}

      {!loading && !error && !invalidRange && metrics.n === 0 && (
        <div className="msg">No matched data for this range.</div>
      )}
    </div>
  );
}
