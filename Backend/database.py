import sqlite_utils
from datetime import datetime
import pandas as pd
import os
import uuid

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

    # Table for Reminders
    if "reminders" not in db.table_names():
        db["reminders"].create({
            "id":               str,
            "original_text":    str,
            "ticker":           str,
            "company_name":     str,
            "action":           str,
            "status":           str,   # active | triggered | expired | cancelled
            "condition_type":   str,   # price_above | price_below | percent_change | time_based | custom
            "target_price":     float,
            "percent_change":   float,
            "trigger_time":     str,
            "custom_condition": str,
            "created_at":       str,
            "triggered_at":     str,
            "current_price":    float,
            "notes":            str,
        }, pk="id")
        print("Created reminders table")

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

# ── Reminder CRUD ─────────────────────────────────────────────────────────────

def create_reminder(data: dict) -> dict:
    db = get_db()
    row = {
        "id":               str(uuid.uuid4()),
        "original_text":    data.get("original_text", ""),
        "ticker":           data.get("ticker", ""),
        "company_name":     data.get("company_name"),
        "action":           data.get("action", "Review and take action"),
        "status":           "active",
        "condition_type":   data.get("condition_type", "custom"),
        "target_price":     data.get("target_price"),
        "percent_change":   data.get("percent_change"),
        "trigger_time":     data.get("trigger_time"),
        "custom_condition": data.get("custom_condition"),
        "created_at":       datetime.now().isoformat(),
        "triggered_at":     None,
        "current_price":    data.get("current_price"),
        "notes":            data.get("notes"),
    }
    db["reminders"].insert(row, pk="id")
    return row

def get_all_reminders() -> list:
    db = get_db()
    return list(db["reminders"].rows_where(order_by="created_at desc"))

def get_reminder_by_id(reminder_id: str) -> dict | None:
    db = get_db()
    try:
        return db["reminders"].get(reminder_id)
    except Exception:
        return None

def update_reminder_status(reminder_id: str, status: str) -> dict | None:
    db = get_db()
    updates = {"status": status}
    if status == "triggered":
        updates["triggered_at"] = datetime.now().isoformat()
    db["reminders"].update(reminder_id, updates)
    return get_reminder_by_id(reminder_id)

def delete_reminder(reminder_id: str) -> bool:
    db = get_db()
    try:
        db["reminders"].delete(reminder_id)
        return True
    except Exception:
        return False

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
