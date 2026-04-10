"""
Detect notable single-step price moves for chart markers (lazy news is keyed by calendar day).
"""
from __future__ import annotations

from typing import Any

# Max markers to show; keeps chart readable and caps Finnhub calls.
_MAX_EVENTS = 8

# Minimum |bar-to-bar % change| to qualify (timeframe-tuned noise floor).
_FLOOR_PCT: dict[str, float] = {
    "1D": 0.12,
    "5D": 0.2,
    "1M": 0.3,
    "3M": 0.45,
    "1Y": 0.9,
    "5Y": 1.2,
}


def event_floor_pct(timeframe: str) -> float:
    """Minimum |bar-to-bar %| to qualify as a chart event marker."""
    return _FLOOR_PCT.get(timeframe, 0.5)


def _calendar_date(time_str: str | None) -> str:
    if not time_str or not isinstance(time_str, str):
        return ""
    return time_str.strip()[:10]


def _sort_key_record(r: dict[str, Any]) -> str:
    return str(r.get("time") or r.get("date") or "")


def prepare_event_rows(records: list[dict[str, Any]], timeframe: str) -> list[dict[str, Any]]:
    """
    Same ordering and 1D session filter as compute_price_events (for debugging / exports).
    """
    if not records or len(records) < 2:
        return []
    rows = sorted(records, key=_sort_key_record)
    if timeframe == "1D":
        today = _calendar_date(rows[-1].get("time") or rows[-1].get("date"))
        if today:
            rows = [r for r in rows if _calendar_date(r.get("time") or r.get("date")) == today]
    return rows if len(rows) >= 2 else []


def bar_pct_changes_for_inspection(records: list[dict[str, Any]], timeframe: str) -> list[dict[str, Any]]:
    """
    Every consecutive bar pair after prepare_event_rows, with pct_change = (close - prev_close) / prev_close * 100.
    """
    rows = prepare_event_rows(records, timeframe)
    out: list[dict[str, Any]] = []
    for i in range(1, len(rows)):
        prev_c = float(rows[i - 1].get("close") or 0)
        cur_c = float(rows[i].get("close") or 0)
        t_prev = str(rows[i - 1].get("time") or rows[i - 1].get("date") or "")
        t = str(rows[i].get("time") or rows[i].get("date") or "")
        if prev_c <= 0:
            pct = None
        else:
            pct = (cur_c - prev_c) / prev_c * 100.0
        out.append(
            {
                "bar_index": i,
                "prev_time": t_prev,
                "time": t,
                "prev_close": round(prev_c, 6),
                "close": round(cur_c, 6),
                "pct_change": None if pct is None else round(pct, 6),
            }
        )
    return out


def compute_price_events(records: list[dict[str, Any]], timeframe: str) -> list[dict[str, Any]]:
    """
    Returns events sorted by time, labeled Event 1..n, one per calendar day (strongest move kept).
    Each record should include 'time' (or 'date'), 'close'.
    """
    rows = prepare_event_rows(records, timeframe)
    if not rows:
        return []

    floor = _FLOOR_PCT.get(timeframe, 0.5)

    moves: list[tuple[float, int, float, str, float, str]] = []
    for i in range(1, len(rows)):
        prev_c = float(rows[i - 1].get("close") or 0)
        cur_c = float(rows[i].get("close") or 0)
        if prev_c <= 0:
            continue
        pct = (cur_c - prev_c) / prev_c * 100.0
        t = str(rows[i].get("time") or rows[i].get("date") or "")
        cal = _calendar_date(t)
        if not cal:
            continue
        moves.append((abs(pct), i, pct, t, cur_c, cal))

    moves.sort(reverse=True, key=lambda x: x[0])

    seen_dates: set[str] = set()
    picked: list[tuple[float, int, float, str, float, str]] = []
    for abs_pct, idx, pct, t, price, cal in moves:
        if abs_pct < floor:
            break
        if cal in seen_dates:
            continue
        seen_dates.add(cal)
        picked.append((abs_pct, idx, pct, t, price, cal))
        if len(picked) >= _MAX_EVENTS:
            break

    # Chronological order for Event 1..n
    picked.sort(key=lambda x: x[3])

    out: list[dict[str, Any]] = []
    for n, (_, _idx, pct, t, price, cal) in enumerate(picked, start=1):
        out.append(
            {
                "index": n,
                "label": f"Event {n}",
                "time": t,
                "event_date": cal,
                "price": round(price, 4),
                "pct_change": round(pct, 3),
            }
        )
    return out
