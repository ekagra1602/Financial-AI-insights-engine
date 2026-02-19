"""
Notification Service — Three Notification Types

Uses existing bars_1m data in SQLite (no extra API calls).

Types:
  1. DAILY_EOD    — ≥ 0% move during the trading day. Triggered once after 4 PM ET.
  2. MOMENTUM_2H  — ≥ 5% move in the last 2 hours. Checked every 15 min.
  3. MORNING_GAP  — ≥ 0% gap (today open vs yesterday close). Triggered once after 9:45 AM ET.

Each notification is generated once and persisted in `generated_notifications` table.
If a stock is added to the watchlist after the trigger time, it still gets checked on the next poll.
"""

from datetime import datetime, timedelta
from database import (
    get_db, get_watchlist,
    save_generated_notification, notification_exists,
    get_generated_notifications_for_date,
)
from services.stock_manager import manager as data_manager
import pytz
import json

ET = pytz.timezone("America/New_York")

DAILY_EOD_THRESHOLD = 0.0      # percent (Trigger on any move)
MOMENTUM_2H_THRESHOLD = 5.0    # percent
MORNING_GAP_THRESHOLD = 0.0    # percent (Trigger on any gap)
LOOKBACK_HOURS = 2
MOMENTUM_INTERVAL_MIN = 15     # generate a new momentum check every 15 min


def _get_bars_1m_range(db, symbol: str, start: str, end: str = None):
    """Get earliest and latest bars_1m rows for a symbol in a time range."""
    query = "symbol = ? AND datetime >= ?"
    args = [symbol, start]
    if end:
        query += " AND datetime <= ?"
        args.append(end)

    try:
        earliest = next(db["bars_1m"].rows_where(query, args, order_by="datetime ASC", limit=1))
    except StopIteration:
        return None, None

    try:
        latest = next(db["bars_1m"].rows_where(query, args, order_by="datetime DESC", limit=1))
    except StopIteration:
        return earliest, None

    return earliest, latest


def _calc_pct_change(open_price: float, close_price: float) -> float:
    if open_price == 0:
        return 0.0
    return ((close_price - open_price) / open_price) * 100


def _format_time(dt_str: str) -> str:
    """Format datetime string to '9:30 AM' style."""
    try:
        dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        # remove leading zero from hour if specific platform supports it, else standard
        return dt.strftime("%-I:%M %p")
    except ValueError:
        return dt_str

def _format_date_short(dt_str: str) -> str:
    """Format: Monday, 17-02-2026"""
    try:
        if "T" in dt_str: # Handle ISO format if passed
             dt = datetime.fromisoformat(dt_str)
        else:
             dt = datetime.strptime(dt_str, "%Y-%m-%d %H:%M:%S")
        return dt.strftime("%A, %d-%m-%Y")
    except ValueError:
        return dt_str

def _make_notification(notif_id: str, notif_type: str, symbol: str, name: str,
                       date_str: str, pct_change: float, open_price: float,
                       close_price: float, start_dt: str, end_dt: str) -> dict:
    direction = "up" if pct_change > 0 else "down"
    arrow = "↑" if direction == "up" else "↓"

    action = "rose" if pct_change > 0 else "fell"
    start_fmt = _format_time(start_dt)
    end_fmt = _format_time(end_dt)
    
    # "From 9:30 AM to 3:59 PM on Monday, DD-MM-YYYY, ZIM fell 6.9% ..."
    # Use end_dt for the date part
    date_text = _format_date_short(end_dt) 

    msg = (
        f"From {start_fmt} to {end_fmt} on {date_text}, {symbol} {action} {abs(pct_change):.1f}% "
        f"(${open_price:.2f} → ${close_price:.2f})"
    )

    if notif_type == "MORNING_GAP":
        # "Overnight gap ... on Monday, DD-MM-YYYY..."
         msg = (
            f"Overnight gap from {start_fmt} (prev close) to {end_fmt} (open) on {date_text}: "
            f"{symbol} {action} {abs(pct_change):.1f}% "
            f"(${open_price:.2f} → ${close_price:.2f})"
        )
    
    # For the UI timestamp header "Monday, MM-DD-YYYY Time"
    # We'll use a new field `formatted_timestamp`? Or override `timestamp`?
    # The `timestamp` field in JSON currently comes from `created_at`.
    # But `created_at` is generated when saving to DB (in `save_generated_notification`).
    # We can't change it here easily without changing how `save_generated_notification` works.
    # However, `save_generated_notification` takes the dict we return here.
    # If we add `created_at` to the dict, maybe it uses it?
    # Let's check `database.py`. 
    # Current behavior: `save_generated_notification` uses `datetime.now().isoformat()` if not present?
    # Re-reading `database.py` would trigger more tool calls.
    # I'll rely on Frontend formatting for valid ISO timestamps if possible.
    # BUT user said "for the notifications view, I wanna change the date format... like 'Monday, MM-DD-YYYY Time'".
    # Frontend `NotificationPanel` displays `{n.timestamp}`.
    # If I don't touch frontend, I must ensure `n.timestamp` IS formatted string.
    # But `stock_data.py` (step 412) shows:
    # "timestamp": r["created_at"]
    # So `generated_notifications` table stores ISO string?
    # If I change what is stored in DB `created_at` column to be a formatted string, it might break sorting/parsing?
    # Usually `created_at` should be ISO for sorting.
    # I should change **Frontend** to format the timestamp.
    # OR change the API response in `notification_service.py` to format it before returning.
    # The `generate_all_notifications` function (at bottom of file) does:
    # "timestamp": r["created_at"]
    # I can format it THERE.
    
    return {
        "id": notif_id,
        "type": notif_type,
        "symbol": symbol,
        "date": date_str,
        "title": f"{symbol} {arrow} {abs(pct_change):.1f}%",
        "message": msg,
        "direction": direction,
        "percentChange": round(pct_change, 2),
        # created_at will be added by database save if missing
    }


# ===== 1. Daily End-of-Day (after 4 PM ET) =====

def _check_daily_eod(db, watchlist) -> list[dict]:
    """
    After 4 PM ET, compare 9:30 AM open to latest close for the day.
    Triggered once per symbol per day.
    """
    now_et = datetime.now(ET)
    today_str = now_et.strftime("%Y-%m-%d")

    # Only trigger after market close (4:00 PM ET)
    market_close = now_et.replace(hour=16, minute=0, second=0, microsecond=0)

    new_notifications = []

    for item in watchlist:
        symbol = item["symbol"]
        name = item.get("name", symbol)
        notif_id = f"{symbol}_DAILY_EOD_{today_str}"

        # Skip if already generated
        if notification_exists(notif_id):
            continue

        # Only fire after market close, OR if stock was added after market close
        stock_added_at = item.get("added_at", "")
        added_after_close = False
        if stock_added_at:
            try:
                added_dt = datetime.fromisoformat(stock_added_at)
                if added_dt.astimezone(ET) > market_close.astimezone(ET) if market_close.tzinfo else added_dt > market_close.replace(tzinfo=None):
                    added_after_close = True
            except (ValueError, TypeError):
                pass

        if now_et < market_close and not added_after_close:
            continue

        # Compare 9:30 AM open to last close of the day
        market_open_str = now_et.replace(hour=9, minute=30, second=0).strftime("%Y-%m-%d %H:%M:%S")
        earliest, latest = _get_bars_1m_range(db, symbol, market_open_str)

        if not earliest or not latest:
            continue

        open_price = float(earliest["close"])
        close_price = float(latest["close"])
        pct = _calc_pct_change(open_price, close_price)

        if abs(pct) >= DAILY_EOD_THRESHOLD:
            n = _make_notification(
                notif_id, "DAILY_EOD", symbol, name, today_str,
                pct, open_price, close_price, earliest["datetime"], latest["datetime"]
            )
            save_generated_notification(n)
            new_notifications.append(n)

    return new_notifications


# ===== 2. Two-Hour Momentum (every 15 min) =====

def _check_2h_momentum(db, watchlist) -> list[dict]:
    """
    Check if any stock moved ≥ 5% in the last 2 hours.
    Uses 15-minute time buckets so we don't spam the same alert.
    """
    now = datetime.now()
    now_et = datetime.now(ET)
    today_str = now_et.strftime("%Y-%m-%d")

    # Round to nearest 15-minute bucket
    minute_bucket = (now.minute // MOMENTUM_INTERVAL_MIN) * MOMENTUM_INTERVAL_MIN
    bucket_str = now.replace(minute=minute_bucket, second=0, microsecond=0).strftime("%H%M")

    cutoff = (now - timedelta(hours=LOOKBACK_HOURS)).strftime("%Y-%m-%d %H:%M:%S")

    new_notifications = []

    for item in watchlist:
        symbol = item["symbol"]
        name = item.get("name", symbol)
        notif_id = f"{symbol}_MOMENTUM_2H_{today_str}_{bucket_str}"

        if notification_exists(notif_id):
            continue

        earliest, latest = _get_bars_1m_range(db, symbol, cutoff)
        if not earliest or not latest:
            continue

        open_price = float(earliest["close"])
        close_price = float(latest["close"])
        pct = _calc_pct_change(open_price, close_price)

        if abs(pct) >= MOMENTUM_2H_THRESHOLD:
            n = _make_notification(
                notif_id, "MOMENTUM_2H", symbol, name, today_str,
                pct, open_price, close_price, earliest["datetime"], latest["datetime"]
            )
            save_generated_notification(n)
            new_notifications.append(n)

    return new_notifications


# ===== 3. Morning Gap (after 9:45 AM ET) =====

def _check_morning_gap(db, watchlist) -> list[dict]:
    """
    After 9:45 AM ET, compare today's open (9:30 AM) vs yesterday's last close.
    Triggered once per symbol per day.
    """
    now_et = datetime.now(ET)
    today_str = now_et.strftime("%Y-%m-%d")

    # Only trigger after 9:45 AM ET
    trigger_time = now_et.replace(hour=9, minute=45, second=0, microsecond=0)

    new_notifications = []

    for item in watchlist:
        symbol = item["symbol"]
        name = item.get("name", symbol)
        notif_id = f"{symbol}_MORNING_GAP_{today_str}"

        if notification_exists(notif_id):
            continue

        # Fire after 9:45 AM, OR if stock was added later (still check)
        stock_added_at = item.get("added_at", "")
        added_after_trigger = False
        if stock_added_at:
            try:
                added_dt = datetime.fromisoformat(stock_added_at)
                if added_dt > trigger_time.replace(tzinfo=None):
                    added_after_trigger = True
            except (ValueError, TypeError):
                pass

        if now_et < trigger_time and not added_after_trigger:
            continue

        # Today's open: first bar at/after 9:30 AM
        market_open_str = now_et.replace(hour=9, minute=30, second=0).strftime("%Y-%m-%d %H:%M:%S")
        today_end_str = now_et.replace(hour=9, minute=45, second=0).strftime("%Y-%m-%d %H:%M:%S")

        try:
            today_open_row = next(
                db["bars_1m"].rows_where(
                    "symbol = ? AND datetime >= ? AND datetime <= ?",
                    [symbol, market_open_str, today_end_str],
                    order_by="datetime ASC", limit=1,
                )
            )
        except StopIteration:
            continue

        # Yesterday's close: last available bar BEFORE today's open
        # This handles weekends, holidays, and data gaps gracefully
        try:
            yesterday_close_row = next(
                db["bars_1m"].rows_where(
                    "symbol = ? AND datetime < ?",
                    [symbol, market_open_str],
                    order_by="datetime DESC", limit=1,
                )
            )
        except StopIteration:
            continue

        prev_close = float(yesterday_close_row["close"])
        today_open = float(today_open_row["close"])
        pct = _calc_pct_change(prev_close, today_open)

        if abs(pct) >= MORNING_GAP_THRESHOLD:
            n = _make_notification(
                notif_id, "MORNING_GAP", symbol, name, today_str,
                pct, prev_close, today_open, yesterday_close_row["datetime"], today_open_row["datetime"]
            )
            save_generated_notification(n)
            new_notifications.append(n)

    return new_notifications

# News briefing generation has been moved to routers/news_briefing.py
# to avoid blocking the notification polling endpoint.

def _format_timestamp_display(iso_str: str) -> str:
    """
    Format '2026-02-12T18:45:11' -> 'Monday, 02-12-2026 06:45 PM'
    """
    if not iso_str:
        return ""
    try:
        # ISO string might be '2026-02-12T18:45:11.123456'
        dt = datetime.fromisoformat(iso_str)
        return dt.strftime("%A, %m-%d-%Y %I:%M %p")
    except ValueError:
        return iso_str

# ===== Main Entry Point =====

def generate_all_notifications() -> list[dict]:
    """
    Run EOD, momentum, and morning gap notification generators, save new ones to DB,
    return ALL notifications for today (from DB), including any news briefings.
    News briefing generation is handled by a separate endpoint.
    """
    watchlist = get_watchlist()
    if not watchlist:
        return []

    # Ensure bars_1m data exists for all watchlist symbols
    # Uses existing Twelve Data pipeline with built-in caching (no redundant calls)
    for item in watchlist:
        try:
            data_manager.get_stock_data(item["symbol"], "1min")
        except Exception as e:
            print(f"  [Notification] Could not prefetch data for {item['symbol']}: {e}")

    db = get_db()
    if "bars_1m" not in db.table_names():
        return []

    # Generate new notifications (each function handles its own trigger logic)
    _check_daily_eod(db, watchlist)
    _check_2h_momentum(db, watchlist)
    _check_morning_gap(db, watchlist)
    # News briefing is NOT called here — it's triggered by a separate endpoint

    # Return all generated notifications for today
    today_str = datetime.now(ET).strftime("%Y-%m-%d")
    rows = get_generated_notifications_for_date(today_str)

    # Normalize column name from DB (percent_change -> percentChange)
    results = []
    for r in rows:
        item = {
            "id": r["id"],
            "type": r["type"],
            "symbol": r["symbol"],
            "title": r["title"],
            "message": r["message"],
            "direction": r["direction"],
            "percentChange": r["percent_change"],
            "timestamp": _format_timestamp_display(r["created_at"]),
        }
        # For NEWS_BRIEFING, include the articles array from DB
        if r["type"] == "NEWS_BRIEFING":
            articles_str = r.get("articles_json", "")
            try:
                item["articles"] = json.loads(articles_str) if articles_str else []
            except (json.JSONDecodeError, TypeError):
                item["articles"] = []
        results.append(item)

    return results

