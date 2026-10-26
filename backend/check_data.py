import pandas as pd

a = pd.read_parquet("data/actuals.parquet")
f = pd.read_parquet("data/forecasts.parquet")

print("actuals:", a.shape, "| forecasts:", f.shape)
print("\nforecast sample:\n", f.head())
print("\nforecasts per target (describe):\n", f.groupby("startTime").size().describe())
print("\nactual step sizes:\n", a["startTime"].diff().value_counts().head())
print("\nforecast target step sizes:\n", f["startTime"].drop_duplicates().sort_values().diff().value_counts().head())