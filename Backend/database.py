"""
Database layer — all data stored in Supabase (PostgreSQL).
Drop-in replacement for the old SQLite-based database.py.
"""

import os
import uuid
import threading
from datetime import datetime
from typing import Optional

import pandas as pd
from supabase import create_client, Client
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), ".env"))

_thread_local = threading.local()


def _get_client() -> Client:
    """Return a thread-local Supabase client (httpx is not thread-safe)."""
    client = getattr(_thread_local, "supabase", None)
    if client is None:
        url = os.getenv("SUPABASE_URL")
        key = os.getenv("SUPABASE_KEY")
        if not url or not key:
            raise RuntimeError("SUPABASE_URL and SUPABASE_KEY must be set in .env")
        client = create_client(url, key)
        _thread_local.supabase = client
    return client


def init_db():
    """Verify Supabase connection. Tables are created via supabase_schema.sql."""
    client = _get_client()
    # Quick connectivity check — read user_settings row
    try:
        client.table("user_settings").select("id").limit(1).execute()
        print("Supabase connection OK")
    except Exception as e:
        print(f"Supabase connection check failed: {e}")
        print("Make sure you have run supabase_schema.sql in your Supabase SQL editor.")


# ===== Watchlist =====

def add_to_watchlist(symbol: str, name: str):
    client = _get_client()
    client.table("watchlist").upsert({
        "symbol": symbol,
        "name": name,
        "added_at": datetime.now().isoformat(),
        "news_notify_count": 0,
    }, on_conflict="symbol").execute()


def remove_from_watchlist(symbol: str):
    client = _get_client()
    client.table("watchlist").delete().eq("symbol", symbol).execute()


def get_watchlist():
    client = _get_client()
    resp = client.table("watchlist").select("*").execute()
    return resp.data


def update_news_notify_count(symbol: str, count: int):
    client = _get_client()
    count = max(0, min(3, count))
    client.table("watchlist").update({"news_notify_count": count}).eq("symbol", symbol).execute()


def get_news_notify_count(symbol: str) -> int:
    client = _get_client()
    resp = client.table("watchlist").select("news_notify_count").eq("symbol", symbol).limit(1).execute()
    if resp.data:
        return resp.data[0].get("news_notify_count", 0) or 0
    return 0


# ===== Dismissed Notifications =====

def dismiss_notification(notification_id: str):
    client = _get_client()
    client.table("dismissed_notifications").upsert({
        "notification_id": notification_id,
        "dismissed_at": datetime.now().isoformat(),
    }, on_conflict="notification_id").execute()


def get_dismissed_notification_ids() -> set:
    client = _get_client()
    resp = client.table("dismissed_notifications").select("notification_id").execute()
    return {row["notification_id"] for row in resp.data}


def clear_all_dismissed():
    client = _get_client()
    # Delete all rows — Supabase requires a filter, so use a tautology
    client.table("dismissed_notifications").delete().neq("notification_id", "").execute()


# ===== Generated Notifications =====

def save_generated_notification(notification: dict):
    client = _get_client()
    client.table("generated_notifications").upsert({
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
    }, on_conflict="id").execute()


def notification_exists(notification_id: str) -> bool:
    client = _get_client()
    resp = client.table("generated_notifications").select("id").eq("id", notification_id).limit(1).execute()
    return len(resp.data) > 0


def get_generated_notifications_for_date(date_str: str) -> list:
    client = _get_client()
    resp = (client.table("generated_notifications")
            .select("*")
            .eq("date", date_str)
            .order("created_at", desc=True)
            .execute())
    return resp.data


# ===== Reminders =====

def create_reminder(data: dict) -> dict:
    client = _get_client()
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
    client.table("reminders").insert(row).execute()
    return row


def get_all_reminders() -> list:
    client = _get_client()
    resp = client.table("reminders").select("*").order("created_at", desc=True).execute()
    return resp.data


def get_reminder_by_id(reminder_id: str) -> Optional[dict]:
    client = _get_client()
    resp = client.table("reminders").select("*").eq("id", reminder_id).limit(1).execute()
    return resp.data[0] if resp.data else None


def update_reminder_status(reminder_id: str, status: str) -> Optional[dict]:
    client = _get_client()
    updates = {"status": status}
    if status == "triggered":
        updates["triggered_at"] = datetime.now().isoformat()
    client.table("reminders").update(updates).eq("id", reminder_id).execute()
    return get_reminder_by_id(reminder_id)


def delete_reminder(reminder_id: str) -> bool:
    client = _get_client()
    try:
        client.table("reminders").delete().eq("id", reminder_id).execute()
        return True
    except Exception:
        return False


# ===== Alerts =====

def create_alert(data: dict) -> dict:
    client = _get_client()
    row = {
        "id":           str(uuid.uuid4()),
        "reminder_id":  data["reminder_id"],
        "ticker":       data["ticker"],
        "message":      data["message"],
        "triggered_at": datetime.now().isoformat(),
        "is_read":      0,
    }
    client.table("alerts").insert(row).execute()
    return row


def get_all_alerts() -> list:
    client = _get_client()
    resp = client.table("alerts").select("*").order("triggered_at", desc=True).execute()
    return resp.data


def mark_alert_read(alert_id: str) -> Optional[dict]:
    client = _get_client()
    try:
        client.table("alerts").update({"is_read": 1}).eq("id", alert_id).execute()
        resp = client.table("alerts").select("*").eq("id", alert_id).limit(1).execute()
        return resp.data[0] if resp.data else None
    except Exception:
        return None


def dismiss_alert(alert_id: str) -> bool:
    client = _get_client()
    try:
        client.table("alerts").delete().eq("id", alert_id).execute()
        return True
    except Exception:
        return False


# ===== News Briefing Article Tracking =====

def news_article_already_sent(symbol: str, url_hash: str) -> bool:
    client = _get_client()
    article_id = f"{symbol}_NEWS_{url_hash}"
    resp = client.table("news_briefing_articles").select("id").eq("id", article_id).limit(1).execute()
    return len(resp.data) > 0


def save_news_article_sent(symbol: str, url_hash: str, url: str, date_str: str):
    client = _get_client()
    client.table("news_briefing_articles").upsert({
        "id": f"{symbol}_NEWS_{url_hash}",
        "symbol": symbol,
        "url_hash": url_hash,
        "url": url,
        "date": date_str,
        "created_at": datetime.now().isoformat(),
    }, on_conflict="id").execute()


# ===== Price Bars =====

def save_bars_1d(symbol: str, df: pd.DataFrame):
    if df.empty:
        return
    client = _get_client()
    data = df.copy()
    if 'date' not in data.columns and isinstance(data.index, pd.DatetimeIndex):
        data['date'] = data.index.strftime('%Y-%m-%d')
    elif 'date' in data.columns and pd.api.types.is_datetime64_any_dtype(data['date']):
        data['date'] = data['date'].dt.strftime('%Y-%m-%d')
    data['symbol'] = symbol
    records = data[['symbol', 'date', 'open', 'high', 'low', 'close', 'volume']].to_dict(orient='records')
    # Convert numpy types to Python native for JSON serialization
    records = _sanitize_records(records)
    _batch_upsert(client, "bars_1d", records, on_conflict="symbol,date")


def save_bars_1h(symbol: str, df: pd.DataFrame):
    if df.empty:
        return
    client = _get_client()
    data = df.copy()
    if 'datetime' not in data.columns and isinstance(data.index, pd.DatetimeIndex):
        data['datetime'] = data.index.strftime('%Y-%m-%d %H:%M:%S')
    elif 'datetime' in data.columns and pd.api.types.is_datetime64_any_dtype(data['datetime']):
        data['datetime'] = data['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
    data['symbol'] = symbol
    records = data[['symbol', 'datetime', 'open', 'high', 'low', 'close', 'volume']].to_dict(orient='records')
    records = _sanitize_records(records)
    _batch_upsert(client, "bars_1h", records, on_conflict="symbol,datetime")


def save_bars_1m(symbol: str, df: pd.DataFrame):
    if df.empty:
        return
    client = _get_client()
    data = df.copy()
    if 'datetime' not in data.columns and isinstance(data.index, pd.DatetimeIndex):
        data['datetime'] = data.index.strftime('%Y-%m-%d %H:%M:%S')
    elif 'datetime' in data.columns and pd.api.types.is_datetime64_any_dtype(data['datetime']):
        data['datetime'] = data['datetime'].dt.strftime('%Y-%m-%d %H:%M:%S')
    data['symbol'] = symbol
    records = data[['symbol', 'datetime', 'open', 'high', 'low', 'close', 'volume']].to_dict(orient='records')
    records = _sanitize_records(records)
    _batch_upsert(client, "bars_1m", records, on_conflict="symbol,datetime")


def _sanitize_records(records: list[dict]) -> list[dict]:
    """Convert numpy/pandas types to Python native types for JSON serialization."""
    import numpy as np
    clean = []
    for rec in records:
        clean_rec = {}
        for k, v in rec.items():
            if isinstance(v, (np.integer,)):
                clean_rec[k] = int(v)
            elif isinstance(v, (np.floating,)):
                clean_rec[k] = float(v)
            elif isinstance(v, np.ndarray):
                clean_rec[k] = v.tolist()
            else:
                clean_rec[k] = v
        clean.append(clean_rec)
    return clean


def _batch_upsert(client: Client, table: str, records: list[dict], on_conflict: str, batch_size: int = 500):
    """Upsert records in batches to avoid hitting Supabase payload limits."""
    for i in range(0, len(records), batch_size):
        batch = records[i:i + batch_size]
        client.table(table).upsert(batch, on_conflict=on_conflict).execute()


def get_latest_timestamp(symbol: str, table: str):
    client = _get_client()
    sort_col = "date" if table == "bars_1d" else "datetime"
    resp = (client.table(table)
            .select(sort_col)
            .eq("symbol", symbol)
            .order(sort_col, desc=True)
            .limit(1)
            .execute())
    if resp.data:
        return resp.data[0][sort_col]
    return None


def fetch_history(symbol: str, table: str, start_str: Optional[str] = None):
    client = _get_client()
    sort_col = "date" if table == "bars_1d" else "datetime"
    query = client.table(table).select("*").eq("symbol", symbol)
    if start_str:
        query = query.gte(sort_col, start_str)
    query = query.order(sort_col)
    # Supabase returns max 1000 rows by default; paginate for large datasets
    all_rows = []
    offset = 0
    page_size = 1000
    while True:
        resp = query.range(offset, offset + page_size - 1).execute()
        all_rows.extend(resp.data)
        if len(resp.data) < page_size:
            break
        offset += page_size
    return pd.DataFrame(all_rows)


# ===== User Settings =====

def get_user_settings() -> dict:
    client = _get_client()
    try:
        resp = client.table("user_settings").select("*").eq("id", 1).limit(1).execute()
        if resp.data:
            row = resp.data[0]
            return {
                "email": row.get("email", ""),
                "email_confirmed": bool(row.get("email_confirmed", 0)),
                "email_notifications_enabled": bool(row.get("email_notifications_enabled", 0)),
            }
    except Exception:
        pass
    return {"email": "", "email_confirmed": False, "email_notifications_enabled": False}


def save_user_email(email: str, confirmation_code: str):
    client = _get_client()
    client.table("user_settings").update({
        "email": email,
        "email_confirmed": 0,
        "email_notifications_enabled": 0,
        "confirmation_code": confirmation_code,
        "updated_at": datetime.now().isoformat(),
    }).eq("id", 1).execute()


def verify_confirmation_code(code: str) -> bool:
    client = _get_client()
    try:
        resp = client.table("user_settings").select("confirmation_code").eq("id", 1).limit(1).execute()
        if resp.data:
            return resp.data[0].get("confirmation_code", "") == code
    except Exception:
        pass
    return False


def set_email_confirmed():
    client = _get_client()
    client.table("user_settings").update({
        "email_confirmed": 1,
        "confirmation_code": "",
        "updated_at": datetime.now().isoformat(),
    }).eq("id", 1).execute()


def toggle_email_notifications(enabled: bool):
    client = _get_client()
    client.table("user_settings").update({
        "email_notifications_enabled": 1 if enabled else 0,
        "updated_at": datetime.now().isoformat(),
    }).eq("id", 1).execute()


# ===== Bars query helper (used by notification_service) =====

def get_bars_1m_range(symbol: str, start: str, end: str = None):
    """
    Get earliest and latest bars_1m rows for a symbol in a time range.
    Returns (earliest_row, latest_row) or (None, None).
    """
    client = _get_client()

    # Earliest
    q = client.table("bars_1m").select("*").eq("symbol", symbol).gte("datetime", start)
    if end:
        q = q.lte("datetime", end)
    resp = q.order("datetime").limit(1).execute()
    earliest = resp.data[0] if resp.data else None

    if not earliest:
        return None, None

    # Latest
    q2 = client.table("bars_1m").select("*").eq("symbol", symbol).gte("datetime", start)
    if end:
        q2 = q2.lte("datetime", end)
    resp2 = q2.order("datetime", desc=True).limit(1).execute()
    latest = resp2.data[0] if resp2.data else None

    return earliest, latest


def get_bars_1m_row(symbol: str, operator: str, datetime_val: str, order_asc: bool = True):
    """
    Get a single bars_1m row. Used for morning gap queries.
    operator: 'gte' or 'lt'
    """
    client = _get_client()
    q = client.table("bars_1m").select("*").eq("symbol", symbol)
    if operator == "gte":
        q = q.gte("datetime", datetime_val)
    elif operator == "lt":
        q = q.lt("datetime", datetime_val)
    elif operator == "lte":
        q = q.lte("datetime", datetime_val)
    order_dir = not order_asc  # desc=True means descending
    q = q.order("datetime", desc=(not order_asc)).limit(1)
    resp = q.execute()
    return resp.data[0] if resp.data else None


if __name__ == "__main__":
    init_db()
