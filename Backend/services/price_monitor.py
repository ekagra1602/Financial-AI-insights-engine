"""
Background price monitor.

Runs every 5 minutes, fetches the current price for every ticker that has
at least one active reminder, evaluates conditions, and fires alerts when
conditions are met.
"""

import asyncio
from datetime import datetime


MONITOR_INTERVAL = 300  # seconds between checks (5 minutes)


def _check_condition(reminder: dict, current_price: float) -> bool:
    ct       = reminder["condition_type"]
    target   = reminder["target_price"]
    pct      = reminder["percent_change"]
    base     = reminder["current_price"]   # price captured at creation time
    trig_t   = reminder["trigger_time"]

    if ct == "price_above" and target is not None:
        return current_price >= target

    if ct == "price_below" and target is not None:
        return current_price <= target

    if ct == "percent_change" and pct is not None and base and base > 0:
        actual_pct = (current_price - base) / base * 100
        return actual_pct >= pct if pct > 0 else actual_pct <= pct

    if ct == "time_based" and trig_t:
        try:
            return datetime.now() >= datetime.fromisoformat(trig_t)
        except ValueError:
            return False

    return False


def _build_message(reminder: dict, current_price: float) -> str:
    ct     = reminder["condition_type"]
    ticker = reminder["ticker"]
    action = reminder["action"]

    if ct == "price_above":
        return (
            f"{ticker} has risen above ${reminder['target_price']:.2f}. "
            f"Current price: ${current_price:.2f}. Action: {action}"
        )
    if ct == "price_below":
        return (
            f"{ticker} has dropped below ${reminder['target_price']:.2f}. "
            f"Current price: ${current_price:.2f}. Action: {action}"
        )
    if ct == "percent_change":
        pct = reminder["percent_change"]
        direction = "gained" if pct > 0 else "dropped"
        return (
            f"{ticker} has {direction} {abs(pct):.1f}%. "
            f"Current price: ${current_price:.2f}. Action: {action}"
        )
    if ct == "time_based":
        return f"Time-based reminder for {ticker} triggered. Action: {action}"

    return f"Reminder for {ticker} triggered. Current price: ${current_price:.2f}. Action: {action}"


async def check_single_reminder(reminder: dict):
    """
    Immediately evaluate one reminder right after it's created.
    Fires an alert if the condition is already met.
    """
    from database import update_reminder_status, create_alert
    from services.finnhub_client import get_finnhub_quote
    from services.email_service import send_alert_email

    try:
        quote = get_finnhub_quote(reminder["ticker"])
        current_price = quote.get("c")
    except Exception as e:
        print(f"[Monitor] Could not fetch price for {reminder['ticker']} on creation check: {e}")
        return

    if current_price and _check_condition(reminder, current_price):
        update_reminder_status(reminder["id"], "triggered")
        alert = {
            "reminder_id": reminder["id"],
            "ticker":      reminder["ticker"],
            "message":     _build_message(reminder, current_price),
        }
        create_alert(alert)
        send_alert_email(alert, reminder)
        print(f"[Monitor] Instant trigger — {reminder['ticker']} condition already met at ${current_price:.2f}")


async def run_check():
    """Single pass: check all active reminders and fire alerts where conditions are met."""
    from database import get_all_reminders, update_reminder_status, create_alert, get_reminder_by_id
    from services.finnhub_client import get_finnhub_quote
    from services.email_service import send_alert_email

    reminders = get_all_reminders()
    active = [r for r in reminders if r["status"] == "active"]

    if not active:
        return

    # Fetch prices once per unique ticker to stay within Finnhub rate limits
    tickers = list({r["ticker"] for r in active})
    prices: dict[str, float] = {}

    for ticker in tickers:
        try:
            quote = get_finnhub_quote(ticker)
            price = quote.get("c")
            if price:
                prices[ticker] = price
        except Exception as e:
            print(f"[Monitor] Could not fetch price for {ticker}: {e}")
        await asyncio.sleep(0.2)   # ~5 req/s stays well under free-tier limits

    triggered_count = 0
    for reminder in active:
        price = prices.get(reminder["ticker"])
        if price is None:
            continue

        if _check_condition(reminder, price):
            update_reminder_status(reminder["id"], "triggered")
            alert = {
                "reminder_id": reminder["id"],
                "ticker":      reminder["ticker"],
                "message":     _build_message(reminder, price),
            }
            create_alert(alert)
            send_alert_email(alert, reminder)
            triggered_count += 1
            print(
                f"[Monitor] TRIGGERED — {reminder['ticker']} "
                f"(condition: {reminder['condition_type']}, price: ${price:.2f})"
            )

    print(
        f"[Monitor] Check complete — {len(active)} active, "
        f"{len(tickers)} tickers fetched, {triggered_count} triggered."
    )


async def monitor_loop():
    """Runs indefinitely, calling run_check() every MONITOR_INTERVAL seconds."""
    print(f"[Monitor] Started — checking every {MONITOR_INTERVAL}s")
    while True:
        try:
            await run_check()
        except Exception as e:
            print(f"[Monitor] Unexpected error during check: {e}")
        await asyncio.sleep(MONITOR_INTERVAL)
