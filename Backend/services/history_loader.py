"""
Load OHLCV records for chart timeframes (same logic as GET /history/{symbol}).
"""
from __future__ import annotations

from datetime import datetime, timedelta
from typing import Any

import pandas as pd

from services.stock_manager import manager


def load_chart_history_records(symbol: str, timeframe: str) -> list[dict[str, Any]]:
    """
    Returns list of dicts with 'time' and 'close' (plus other columns from the dataframe).
    timeframe: 1D, 5D, 1M, 3M, 1Y, 5Y
    """
    symbol = symbol.upper()
    df = pd.DataFrame()

    try:
        if timeframe == "1D":
            df = manager.get_stock_data(symbol, "1min")
            if not df.empty and "datetime" in df.columns:
                df["dt"] = pd.to_datetime(df["datetime"])
                cutoff = datetime.now() - timedelta(hours=24)
                df = df[df["dt"] >= cutoff]

        elif timeframe == "5D":
            df = manager.get_stock_data(symbol, "1h")
            if not df.empty and "datetime" in df.columns:
                df["dt"] = pd.to_datetime(df["datetime"])
                df = df.sort_values("dt", ascending=False)
                df["date_only"] = df["dt"].dt.date
                unique_dates = df["date_only"].unique()
                if len(unique_dates) > 5:
                    cutoff_date = unique_dates[4]
                    df = df[df["date_only"] >= cutoff_date]
                df = df.sort_values("dt", ascending=True)

        elif timeframe in ["1M", "3M"]:
            df = manager.get_stock_data(symbol, "1h")
            if not df.empty and "datetime" in df.columns:
                df["dt"] = pd.to_datetime(df["datetime"])
                days = 30 if timeframe == "1M" else 90
                cutoff = datetime.now() - timedelta(days=days)
                df = df[df["dt"] >= cutoff]

        elif timeframe == "5Y":
            df = manager.get_stock_data(symbol, "1day")
            if not df.empty and "date" in df.columns:
                df["dt"] = pd.to_datetime(df["date"])
                cutoff = datetime.now() - timedelta(days=365 * 5)
                df = df[df["dt"] >= cutoff]
                df.set_index("dt", inplace=True)
                agg_dict = {
                    col: "first"
                    if col == "open"
                    else "max"
                    if col == "high"
                    else "min"
                    if col == "low"
                    else "last"
                    if col == "close"
                    else "sum"
                    if col == "volume"
                    else "first"
                    for col in df.columns
                    if col not in ["datetime", "symbol", "date", "dt"]
                }
                agg_dict = {k: v for k, v in agg_dict.items() if k in df.columns}
                if not df.empty:
                    df_resampled = df.resample("W-FRI").agg(agg_dict).dropna()
                    df_resampled["date"] = df_resampled.index.strftime("%Y-%m-%d")
                    df_resampled["symbol"] = symbol
                    df = df_resampled.reset_index()

        else:
            df = manager.get_stock_data(symbol, "1day")
            if not df.empty and "date" in df.columns:
                df["dt"] = pd.to_datetime(df["date"])
                cutoff = datetime.now() - timedelta(days=365)
                df = df[df["dt"] >= cutoff]

    except Exception as e:
        print(f"Error loading chart history: {e}")
        return []

    if df.empty:
        return []

    if "datetime" in df.columns:
        df["time"] = df["datetime"]
    elif "date" in df.columns:
        df["time"] = df["date"]

    return df.to_dict(orient="records")
