from datetime import date
from functools import lru_cache
from typing import Literal

import pandas as pd
from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware

import pipeline as p

app = FastAPI(title="Wind Forecast Monitor API", version="1.0.0")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])

ACTUALS, FORECASTS = p.load_data()


@lru_cache(maxsize=24)
def comparison(decision_hour: int) -> pd.DataFrame:
    return p.build_comparison(ACTUALS, FORECASTS, decision_hour)


def filtered(decision_hour: int, start: date | None, end: date | None) -> pd.DataFrame:
    df = comparison(decision_hour)
    if start:
        df = df[df["startTime"] >= pd.Timestamp(start, tz="UTC")]
    if end:
        df = df[df["startTime"] < pd.Timestamp(end, tz="UTC") + pd.Timedelta(days=1)]
    return df


DecisionHour = Query(p.DEFAULT_DECISION_HOUR, ge=0, le=23,
                     description="UTC hour on D-1 when the buying decision is made")


@app.get("/api/health")
def health():
    return {"status": "ok", "actual_rows": len(ACTUALS), "forecast_rows": len(FORECASTS)}


@app.get("/api/forecast-vs-actual")
def forecast_vs_actual(start: date | None = None, end: date | None = None,
                       decision_hour: int = DecisionHour):
    """Per half-hour: the forecast that was latest-available at decision time, vs actual.
    lower/upper = forecast -/+ P90 abs error (computed over the full month, so it is
    descriptive, not a strict out-of-sample band)."""
    full = comparison(decision_hour)
    if full.empty:
        raise HTTPException(404, "No data")
    p90 = p.metrics(full)["p90_abs"]
    df = filtered(decision_hour, start, end)

    rows = [{
        "startTime": r.startTime.isoformat(),
        "publishTime": r.publishTime.isoformat(),
        "cutoff": r.cutoff.isoformat(),
        "horizonHours": round(r.horizon_h, 2),
        "actual": r.actual,
        "forecast": r.forecast,
        "error": r.error,
        "lower": max(r.forecast - p90, 0),
        "upper": r.forecast + p90,
    } for r in df.itertuples()]
    return {"decisionHour": decision_hour, "p90Band": p90, "points": rows}


@app.get("/api/metrics")
def get_metrics(start: date | None = None, end: date | None = None,
                decision_hour: int = DecisionHour):
    df = filtered(decision_hour, start, end)
    # Coverage: how many actual half-hours had a usable forecast
    a = ACTUALS
    if start:
        a = a[a["startTime"] >= pd.Timestamp(start, tz="UTC")]
    if end:
        a = a[a["startTime"] < pd.Timestamp(end, tz="UTC") + pd.Timedelta(days=1)]
    return {
        "decisionHour": decision_hour,
        "metrics": p.metrics(df),
        "coverage": {"actualTargets": len(a), "matched": len(df), "missing": len(a) - len(df)},
    }


@app.get("/api/metrics/breakdown")
def get_breakdown(by: Literal["horizon", "hour"] = "horizon",
                  start: date | None = None, end: date | None = None,
                  decision_hour: int = DecisionHour):
    df = filtered(decision_hour, start, end)
    return {"by": by, "decisionHour": decision_hour, "rows": p.breakdown(df, by) if len(df) else []}