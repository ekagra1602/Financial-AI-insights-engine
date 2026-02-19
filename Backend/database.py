import sqlite_utils
from datetime import datetime
import pandas as pd
import os
import sqlite3

DB_PATH = os.path.join(os.path.dirname(__file__), "stock_data.db")

def get_db():
    # Use WAL mode for concurrent read/write and a 10s busy timeout
    # to avoid "database is locked" errors from concurrent requests
    conn = sqlite3.connect(DB_PATH, timeout=10)
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA busy_timeout=10000")
    return sqlite_utils.Database(conn)

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
            "news_notify_count": int,  # 0/1/2/3 briefings per day
        }, pk="symbol")
        print("Created watchlist table")
    else:
        # Migration: add news_notify_count if missing
        cols = {col.name for col in db["watchlist"].columns}
        if "news_notify_count" not in cols:
            db.execute("ALTER TABLE watchlist ADD COLUMN news_notify_count INTEGER DEFAULT 0")
            print("Added news_notify_count column to watchlist")

    # Table for dismissed notifications
    if "dismissed_notifications" not in db.table_names():
        db["dismissed_notifications"].create({
            "notification_id": str,
            "dismissed_at": str,
        }, pk="notification_id")
        print("Created dismissed_notifications table")

    # Table for generated notifications (trigger-once persistence)
    if "generated_notifications" not in db.table_names():
        db["generated_notifications"].create({
            "id": str,
            "type": str,       # DAILY_EOD, MOMENTUM_2H, MORNING_GAP, NEWS_BRIEFING
            "symbol": str,
            "date": str,       # YYYY-MM-DD
            "title": str,
            "message": str,
            "direction": str,  # up / down / neutral
            "percent_change": float,
            "created_at": str,
            "articles_json": str,  # JSON array for NEWS_BRIEFING articles
        }, pk="id")
        print("Created generated_notifications table")
    else:
        # Migration: add articles_json if missing
        cols = {col.name for col in db["generated_notifications"].columns}
        if "articles_json" not in cols:
            db.execute("ALTER TABLE generated_notifications ADD COLUMN articles_json TEXT DEFAULT ''")
            print("Added articles_json column to generated_notifications")

    # Table for tracking sent news articles (dedup)
    if "news_briefing_articles" not in db.table_names():
        db["news_briefing_articles"].create({
            "id": str,          # {symbol}_NEWS_{url_hash}
            "symbol": str,
            "url_hash": str,
            "url": str,
            "date": str,        # YYYY-MM-DD
            "created_at": str,
        }, pk="id")
        print("Created news_briefing_articles table")

def add_to_watchlist(symbol: str, name: str):
    db = get_db()
    db["watchlist"].upsert({
        "symbol": symbol,
        "name": name,
        "added_at": datetime.now().isoformat(),
        "news_notify_count": 0,
    }, pk="symbol")

def remove_from_watchlist(symbol: str):
    db = get_db()
    db["watchlist"].delete(symbol)

def get_watchlist():
    db = get_db()
    return list(db["watchlist"].rows)

def update_news_notify_count(symbol: str, count: int):
    """Update how many news briefings per day (0-3) for a ticker."""
    db = get_db()
    count = max(0, min(3, count))  # Clamp 0-3
    db["watchlist"].update(symbol, {"news_notify_count": count})

def get_news_notify_count(symbol: str) -> int:
    db = get_db()
    try:
        row = next(db["watchlist"].rows_where("symbol = ?", [symbol]))
        return row.get("news_notify_count", 0) or 0
    except StopIteration:
        return 0

# ===== Dismissed Notifications =====

def dismiss_notification(notification_id: str):
    db = get_db()
    db["dismissed_notifications"].upsert({
        "notification_id": notification_id,
        "dismissed_at": datetime.now().isoformat()
    }, pk="notification_id")

def get_dismissed_notification_ids() -> set:
    db = get_db()
    if "dismissed_notifications" not in db.table_names():
        return set()
    return {row["notification_id"] for row in db["dismissed_notifications"].rows}

def clear_all_dismissed():
    db = get_db()
    if "dismissed_notifications" in db.table_names():
        db["dismissed_notifications"].delete_where()

# ===== Generated Notifications =====

def save_generated_notification(notification: dict):
    """Save a generated notification to the DB (trigger-once)."""
    db = get_db()
    db["generated_notifications"].upsert({
        "id": notification["id"],
        "type": notification["type"],
        "symbol": notification["symbol"],
        "date": notification["date"],
        "title": notification["title"],
        "message": notification["message"],
        "direction": notification["direction"],
        "percent_change": notification["percentChange"],
        "created_at": datetime.now().isoformat(),
        "articles_json": notification.get("articles", ""),
    }, pk="id")

def notification_exists(notification_id: str) -> bool:
    """Check if a notification has already been generated."""
    db = get_db()
    if "generated_notifications" not in db.table_names():
        return False
    try:
        next(db["generated_notifications"].rows_where("id = ?", [notification_id]))
        return True
    except StopIteration:
        return False

def get_generated_notifications_for_date(date_str: str) -> list[dict]:
    """Get all generated notifications for a given date."""
    db = get_db()
    if "generated_notifications" not in db.table_names():
        return []
    return list(db["generated_notifications"].rows_where("date = ?", [date_str]))

# ===== News Briefing Article Tracking =====

def news_article_already_sent(symbol: str, url_hash: str) -> bool:
    """Check if we already sent a notification for this article."""
    db = get_db()
    if "news_briefing_articles" not in db.table_names():
        return False
    article_id = f"{symbol}_NEWS_{url_hash}"
    try:
        next(db["news_briefing_articles"].rows_where("id = ?", [article_id]))
        return True
    except StopIteration:
        return False

def save_news_article_sent(symbol: str, url_hash: str, url: str, date_str: str):
    """Mark an article as sent for a symbol."""
    db = get_db()
    db["news_briefing_articles"].upsert({
        "id": f"{symbol}_NEWS_{url_hash}",
        "symbol": symbol,
        "url_hash": url_hash,
        "url": url,
        "date": date_str,
        "created_at": datetime.now().isoformat(),
    }, pk="id")

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
