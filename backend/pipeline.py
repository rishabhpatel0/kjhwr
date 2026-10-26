# backend/pipeline.py
from datetime import datetime, timedelta, timezone
from pathlib import Path

import httpx
import pandas as pd

BASE = "https://data.elexon.co.uk/bmrs/api/v1/datasets"
DATA_DIR = Path(__file__).parent / "data"
ACTUALS_PATH = DATA_DIR / "actuals.parquet"
FORECASTS_PATH = DATA_DIR / "forecasts.parquet"

# Day-ahead decision cutoff on D-1, in UTC. January = UK winter time, so UTC == UK local.
DEFAULT_DECISION_HOUR = 9

TARGET_START = datetime(2026, 1, 1, tzinfo=timezone.utc)
TARGET_END = datetime(2026, 2, 1, tzinfo=timezone.utc)  # exclusive


# ---------- fetching (run once via fetch_data.py) ----------

def _stream(dataset: str, params: dict) -> pd.DataFrame:
    r = httpx.get(f"{BASE}/{dataset}/stream", params=params, timeout=120)
    r.raise_for_status()
    return pd.DataFrame(r.json())


def _windows(start: datetime, end: datetime, days: int = 7):
    cur = start
    while cur < end:
        nxt = min(cur + timedelta(days=days), end)
        yield cur, nxt
        cur = nxt


def fetch_actuals() -> pd.DataFrame:
    frames = []
    for a, b in _windows(TARGET_START, TARGET_END):
        frames.append(_stream("FUELHH", {
            "settlementDateFrom": a.date().isoformat(),
            "settlementDateTo": (b - timedelta(days=1)).date().isoformat(),
            "fuelType": "WIND",
        }))
    df = pd.concat(frames, ignore_index=True)
    df["startTime"] = pd.to_datetime(df["startTime"], utc=True)
    df = df[["startTime", "generation"]].rename(columns={"generation": "actual"})
    return df.drop_duplicates("startTime").sort_values("startTime").reset_index(drop=True)


def fetch_forecasts() -> pd.DataFrame:
    # Forecasts for early-January targets were published in late December.
    start = datetime(2025, 12, 15, tzinfo=timezone.utc)
    frames = []
    for a, b in _windows(start, TARGET_END):
        frames.append(_stream("WINDFOR", {
            "publishDateTimeFrom": a.strftime("%Y-%m-%dT%H:%M:%SZ"),
            "publishDateTimeTo": b.strftime("%Y-%m-%dT%H:%M:%SZ"),
        }))
    df = pd.concat(frames, ignore_index=True)
    for c in ("startTime", "publishTime"):
        df[c] = pd.to_datetime(df[c], utc=True)
    df = df[["startTime", "publishTime", "generation"]].rename(columns={"generation": "forecast"})
    df = df[(df["startTime"] >= TARGET_START) & (df["startTime"] < TARGET_END)]
    return df.drop_duplicates(["startTime", "publishTime"]).reset_index(drop=True)


# ---------- core logic ----------

def load_data() -> tuple[pd.DataFrame, pd.DataFrame]:
    return pd.read_parquet(ACTUALS_PATH), pd.read_parquet(FORECASTS_PATH)


def latest_available_forecast(fc: pd.DataFrame, decision_hour: int = DEFAULT_DECISION_HOUR) -> pd.DataFrame:
    """For each target startTime, the latest forecast published at or before
    (day before target) at decision_hour. Later forecasts are excluded (no leakage)."""
    out = fc.copy()
    day_before = out["startTime"].dt.normalize() - timedelta(days=1)
    out["cutoff"] = day_before + pd.to_timedelta(decision_hour, unit="h")
    out = out[out["publishTime"] <= out["cutoff"]]
    return out.sort_values("publishTime").groupby("startTime", as_index=False).tail(1)


def build_comparison(actuals: pd.DataFrame, fc: pd.DataFrame,
                     decision_hour: int = DEFAULT_DECISION_HOUR) -> pd.DataFrame:
    """Join actuals (30-min) with the decision-time forecast.

    WINDFOR is hourly while FUELHH is half-hourly, so each hourly forecast is
    applied to both half-hours of its hour (forward-fill). Targets with no forecast
    published before the cutoff are dropped and reported as 'missing' by the API."""
    chosen = latest_available_forecast(fc, decision_hour).rename(columns={"startTime": "forecastTarget"})
    a = actuals.copy()
    a["forecastTarget"] = a["startTime"].dt.floor("h")
    df = a.merge(chosen, on="forecastTarget", how="inner")
    df["error"] = df["forecast"] - df["actual"]
    df["abs_error"] = df["error"].abs()
    df["horizon_h"] = (df["forecastTarget"] - df["publishTime"]).dt.total_seconds() / 3600
    return df.sort_values("startTime").reset_index(drop=True)


def metrics(df: pd.DataFrame) -> dict:
    if df.empty:
        return {"n": 0}
    return {
        "n": int(len(df)),
        "mae": float(df["abs_error"].mean()),
        "rmse": float((df["error"] ** 2).mean() ** 0.5),
        "bias": float(df["error"].mean()),
        "p50_abs": float(df["abs_error"].quantile(0.5)),
        "p90_abs": float(df["abs_error"].quantile(0.9)),
        "p99_abs": float(df["abs_error"].quantile(0.99)),
        # One-sided: in 90% of half-hours, forecast - actual was at most this.
        # Use it as the conservative haircut: plan for wind = forecast - p90_over.
        "p90_over": float(max(df["error"].quantile(0.9), 0.0)),
    }


def breakdown(df: pd.DataFrame, by: str) -> list[dict]:
    d = df.copy()
    if by == "horizon":
        d["bucket"] = (d["horizon_h"] // 3 * 3).astype(int)  # 3-hour bins
    elif by == "hour":
        d["bucket"] = d["startTime"].dt.hour
    else:
        raise ValueError(by)
    rows = []
    for bucket, g in d.groupby("bucket"):
        rows.append({"bucket": int(bucket), **metrics(g)})
    return rows