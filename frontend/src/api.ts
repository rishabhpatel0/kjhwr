const API = import.meta.env.VITE_API_URL ?? "http://localhost:8000";

export interface Point {
  startTime: string;
  publishTime: string;
  cutoff: string;
  horizonHours: number;
  actual: number;
  forecast: number;
  error: number;
  lower: number;
  upper: number;
}

export interface Metrics {
  n: number;
  mae?: number;
  rmse?: number;
  bias?: number;
  p50_abs?: number;
  p90_abs?: number;
  p99_abs?: number;
  p90_over?: number;
}

export interface Coverage {
  actualTargets: number;
  matched: number;
  missing: number;
}

export interface BreakdownRow extends Metrics {
  bucket: number;
}

export interface Query {
  start: string;
  end: string;
  decisionHour: number;
}

async function get<T>(path: string, params: Record<string, string | number>): Promise<T> {
  const qs = new URLSearchParams(
    Object.entries(params).map(([k, v]) => [k, String(v)])
  ).toString();
  const res = await fetch(`${API}${path}?${qs}`);
  if (!res.ok) throw new Error(`${path} failed: ${res.status}`);
  return res.json();
}

const base = (q: Query) => ({ start: q.start, end: q.end, decision_hour: q.decisionHour });

export const fetchPoints = (q: Query) =>
  get<{ decisionHour: number; p90Band: number; points: Point[] }>("/api/forecast-vs-actual", base(q));

export const fetchMetrics = (q: Query) =>
  get<{ metrics: Metrics; coverage: Coverage }>("/api/metrics", base(q));

export const fetchBreakdown = (q: Query, by: "horizon" | "hour") =>
  get<{ by: string; rows: BreakdownRow[] }>("/api/metrics/breakdown", { ...base(q), by });