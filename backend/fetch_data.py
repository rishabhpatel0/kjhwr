from pipeline import DATA_DIR, ACTUALS_PATH, FORECASTS_PATH, fetch_actuals, fetch_forecasts

if __name__ == "__main__":
    DATA_DIR.mkdir(exist_ok=True)
    actuals = fetch_actuals()
    forecasts = fetch_forecasts()
    actuals.to_parquet(ACTUALS_PATH)
    forecasts.to_parquet(FORECASTS_PATH)
    print(f"actuals: {len(actuals)} rows, {actuals.startTime.min()} -> {actuals.startTime.max()}")
    print(f"forecasts: {len(forecasts)} rows, {forecasts.publishTime.min()} -> {forecasts.publishTime.max()}")