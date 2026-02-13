"""
Notification Service — Three Notification Types

Uses existing bars_1m data in SQLite (no extra API calls).

Types:
  1. DAILY_EOD    — ≥ 5% move during the trading day. Triggered once after 4 PM ET.
  2. MOMENTUM_2H  — ≥ 5% move in the last 2 hours. Checked every 15 min.
  3. MORNING_GAP  — ≥ 3% gap (today open vs yesterday close). Triggered once after 9:45 AM ET.

Each notification is generated once and persisted in `generated_notifications` table.
If a stock is added to the watchlist after the trigger time, it still gets checked on the next poll.
"""

from datetime import datetime, timedelta
from database import (
    get_db, get_watchlist,
    save_generated_notification, notification_exists,
    get_generated_notifications_for_date,
)
import pytz

ET = pytz.timezone("America/New_York")

DAILY_EOD_THRESHOLD = 5.0      # percent
MOMENTUM_2H_THRESHOLD = 5.0    # percent
MORNING_GAP_THRESHOLD = 3.0    # percent
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

def _make_notification(notif_id: str, notif_type: str, symbol: str, name: str,
                       date_str: str, pct_change: float, open_price: float,
                       close_price: float, start_dt: str, end_dt: str) -> dict:
    direction = "up" if pct_change > 0 else "down"
    arrow = "↑" if direction == "up" else "↓"

    # Descriptive template:
    # "From {start} to {end}: {Symbol} {rose/fell} {pct}% (${open} -> ${close})"
    action = "rose" if pct_change > 0 else "fell"
    start_fmt = _format_time(start_dt)
    end_fmt = _format_time(end_dt)

    # For daily EOD, we might say "Today from ..."
    # For morning gap: "From yesterday close (4 PM) to today open (9:30 AM)..."
    # For now, generic time range is good.
    
    msg = (
        f"From {start_fmt} to {end_fmt}, {symbol} {action} {abs(pct_change):.1f}% "
        f"(${open_price:.2f} → ${close_price:.2f})"
    )

    if notif_type == "MORNING_GAP":
         msg = (
            f"Overnight gap from {start_fmt} (prev close) to {end_fmt} (open): "
            f"{symbol} {action} {abs(pct_change):.1f}% "
            f"(${open_price:.2f} → ${close_price:.2f})"
        )

    return {
        "id": notif_id,
        "type": notif_type,
        "symbol": symbol,
        "date": date_str,
        "title": f"{symbol} {arrow} {abs(pct_change):.1f}%",
        "message": msg,
        "direction": direction,
        "percentChange": round(pct_change, 2),
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

        # Yesterday's close: last bar before today's open
        yesterday = now_et - timedelta(days=1)
        # Skip weekends — go back to Friday if needed
        while yesterday.weekday() >= 5:
            yesterday -= timedelta(days=1)

        yesterday_start = yesterday.replace(hour=9, minute=30, second=0).strftime("%Y-%m-%d %H:%M:%S")
        yesterday_end = yesterday.replace(hour=16, minute=0, second=0).strftime("%Y-%m-%d %H:%M:%S")

        try:
            yesterday_close_row = next(
                db["bars_1m"].rows_where(
                    "symbol = ? AND datetime >= ? AND datetime <= ?",
                    [symbol, yesterday_start, yesterday_end],
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


# ===== Main Entry Point =====

def generate_all_notifications() -> list[dict]:
    """
    Run all 3 notification generators, save new ones to DB,
    return ALL notifications for today (from DB).
    """
    watchlist = get_watchlist()
    if not watchlist:
        return []

    db = get_db()
    if "bars_1m" not in db.table_names():
        return []

    # Generate new notifications (each function handles its own trigger logic)
    _check_daily_eod(db, watchlist)
    _check_2h_momentum(db, watchlist)
    _check_morning_gap(db, watchlist)

    # Return all generated notifications for today
    today_str = datetime.now(ET).strftime("%Y-%m-%d")
    rows = get_generated_notifications_for_date(today_str)

    # Normalize column name from DB (percent_change -> percentChange)
    return [
        {
            "id": r["id"],
            "type": r["type"],
            "symbol": r["symbol"],
            "title": r["title"],
            "message": r["message"],
            "direction": r["direction"],
            "percentChange": r["percent_change"],
            "timestamp": r["created_at"],
        }
        for r in rows
    ]
