import sqlite_utils
from datetime import datetime
import pandas as pd
import os

DB_PATH = os.path.join(os.path.dirname(__file__), "stock_data.db")

def get_db():
    return sqlite_utils.Database(DB_PATH)

def init_db():
    db = get_db()
    
    # Table for daily bars
    if "bars_1d" not in db.table_names():
        db["bars_1d"].create({
            "symbol": str,
            "date": str, # YYYY-MM-DD
            "open": float,
            "high": float,
            "low": float,
            "close": float,
            "volume": int,
        }, pk=("symbol", "date"))
        print("Created bars_1d table")

    # Table for minute bars
    if "bars_1m" not in db.table_names():
        db["bars_1m"].create({
            "symbol": str,
            "datetime": str, # YYYY-MM-DD HH:MM:SS
            "open": float,
            "high": float,
            "low": float,
            "close": float,
            "volume": int,
        }, pk=("symbol", "datetime"))
        print("Created bars_1m table")

    # Table for hourly bars
    if "bars_1h" not in db.table_names():
        db["bars_1h"].create({
            "symbol": str,
            "datetime": str, # YYYY-MM-DD HH:MM:SS
            "open": float,
            "high": float,
            "low": float,
            "close": float,
            "volume": int,
        }, pk=("symbol", "datetime"))
        print("Created bars_1h table")

    # Table for Watchlist
    if "watchlist" not in db.table_names():
        db["watchlist"].create({
            "symbol": str,
            "name": str,
            "added_at": str,
        }, pk="symbol")
        print("Created watchlist table")

def add_to_watchlist(symbol: str, name: str):
    db = get_db()
    db["watchlist"].upsert({
        "symbol": symbol,
        "name": name,
        "added_at": datetime.now().isoformat()
    }, pk="symbol")

def remove_from_watchlist(symbol: str):
    db = get_db()
    db["watchlist"].delete(symbol)

def get_watchlist():
    db = get_db()
    return list(db["watchlist"].rows)

def save_bars_1d(symbol: str, df: pd.DataFrame):
    if df.empty:
        return
    
    db = get_db()
    # Ensure 'date' column exists or is index
    data = df.copy()
    if 'date' not in data.columns and isinstance(data.index, pd.DatetimeIndex):
         data['date'] = data.index.strftime('%Y-%m-%d')
    elif 'date' in data.columns:
        # If it's a datetime object, convert to string
        if pd.api.types.is_datetime64_any_dtype(data['date']):
             data['date'] = data['date'].dt.strftime('%Y-%m-%d')

    # Add symbol column if missing
    data['symbol'] = symbol
    
    # Keep only relevant columns
    records = data[['symbol', 'date', 'open', 'high', 'low', 'close', 'volume']].to_dict(orient='records')
    
    db["bars_1d"].upsert_all(records, pk=("symbol", "date"))

def save_bars_1h(symbol: str, df: pd.DataFrame):
    if df.empty:
        return
    
    db = get_db()
    data = df.copy()
    
    if 'datetime' not in data.columns and isinstance(data.index, pd.DatetimeIndex):
         data['datetime'] = data.index.strftime('%Y-%m-%d %H:%M:%S')
    elif 'datetime' in data.columns:
        if pd.api.types.is_datetime64_any_dtype(data['datetime']):
             data['datetime'] = data['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')

    data['symbol'] = symbol
    records = data[['symbol', 'datetime', 'open', 'high', 'low', 'close', 'volume']].to_dict(orient='records')
    db["bars_1h"].upsert_all(records, pk=("symbol", "datetime"))

def save_bars_1m(symbol: str, df: pd.DataFrame):
    if df.empty:
        return
    
    db = get_db()
    data = df.copy()
    
    # Handle datetime index or column
    if 'datetime' not in data.columns and isinstance(data.index, pd.DatetimeIndex):
         data['datetime'] = data.index.strftime('%Y-%m-%d %H:%M:%S')
    elif 'datetime' in data.columns:
        if pd.api.types.is_datetime64_any_dtype(data['datetime']):
             data['datetime'] = data['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')

    data['symbol'] = symbol
    
    records = data[['symbol', 'datetime', 'open', 'high', 'low', 'close', 'volume']].to_dict(orient='records')
    
    db["bars_1m"].upsert_all(records, pk=("symbol", "datetime"))

def get_latest_timestamp(symbol: str, table: str):
    db = get_db()
    if table not in db.table_names():
        return None
    
    sort_col = "date" if table == "bars_1d" else "datetime"
    
    try:
        row = next(db[table].rows_where("symbol = ?", [symbol], order_by=f"{sort_col} desc", limit=1))
        return row[sort_col]
    except StopIteration:
        return None

def fetch_history(symbol: str, table: str, start_str: str = None):
    db = get_db()
    if table not in db.table_names():
        return pd.DataFrame() # Return empty DF
        
    sort_col = "date" if table == "bars_1d" else "datetime"
    
    query = "symbol = ?"
    args = [symbol]
    
    if start_str:
        query += f" AND {sort_col} >= ?"
        args.append(start_str)
        
    rows = list(db[table].rows_where(query, args, order_by=sort_col))
    return pd.DataFrame(rows)

if __name__ == "__main__":
    init_db()
