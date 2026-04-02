"""
Lazy-fetch company news for chart event dates only.
Uses table `stock_event_news` — separate from `news_articles` summarization cache.
"""
from __future__ import annotations

import hashlib
import re
from typing import Any

from services.finnhub_client import get_company_news_safe, get_finnhub_profile


def _hash_url(url: str) -> str:
    clean_url = (url or "").lower().strip()
    return hashlib.sha256(clean_url.encode("utf-8")).hexdigest()


def _pick_article(raw: list[dict[str, Any]], ticker: str, company_hint: str) -> dict[str, Any] | None:
    if not raw:
        return None
    ticker_u = (ticker or "").upper()
    hint = re.sub(
        r"(?i)\s+(inc\.?|corp\.?|co\.?|ltd\.?|plc|group|holdings|technologies|solutions)\b.*",
        "",
        company_hint or "",
    ).strip()
    candidates = sorted(raw, key=lambda x: x.get("datetime", 0), reverse=True)

    for item in candidates:
        h = (item.get("headline") or "") + " " + (item.get("summary") or "")
        if ticker_u and ticker_u in h.upper():
            return item
    if hint and len(hint) > 2:
        hu = hint.upper()
        for item in candidates:
            h = (item.get("headline") or "")
            if hu in h.upper():
                return item
    return candidates[0]


def get_or_fetch_event_news(
    supabase: Any,
    ticker: str,
    dates: list[str],
    force_refresh: bool = False,
) -> list[dict[str, Any]]:
    """
    For each YYYY-MM-DD in `dates`, return one article row (from DB or Finnhub).
    `supabase` is a SupabaseClient instance.
    """
    if not supabase or not getattr(supabase, "client", None):
        return [_empty_row(d, "Database not configured") for d in dates]

    t = (ticker or "").strip().upper()
    if not t or not dates:
        return []

    uniq_dates = []
    seen: set[str] = set()
    for d in dates:
        if d and d not in seen:
            seen.add(d)
            uniq_dates.append(d[:10])

    company_name = ""
    try:
        prof = get_finnhub_profile(t)
        company_name = (prof or {}).get("name") or ""
    except Exception:
        pass

    results: list[dict[str, Any]] = []
    for event_date in uniq_dates:
        if force_refresh:
            row = None
        else:
            row = supabase.get_stock_event_news(t, event_date)

        if row:
            results.append(
                {
                    "event_date": event_date,
                    "headline": row.get("headline"),
                    "summary": row.get("summary"),
                    "url": row.get("url"),
                    "source": row.get("source"),
                    "from_cache": True,
                }
            )
            continue

        try:
            raw = get_company_news_safe(t, event_date, event_date)
        except Exception as e:
            results.append(_empty_row(event_date, str(e)))
            continue

        picked = _pick_article(raw, t, company_name)
        if not picked:
            results.append(_empty_row(event_date, "No articles from Finnhub for this date"))
            continue

        url = picked.get("url") or ""
        url_hash = _hash_url(url)
        headline = picked.get("headline") or ""
        summary = (picked.get("summary") or "").strip() or headline
        source = picked.get("source") or ""
        article_dt = picked.get("datetime")

        save_row = {
            "ticker": t,
            "event_date": event_date,
            "url_hash": url_hash,
            "headline": headline,
            "summary": summary[:8000] if summary else None,
            "source": source,
            "url": url,
            "article_datetime": article_dt,
        }
        supabase.upsert_stock_event_news(save_row)

        results.append(
            {
                "event_date": event_date,
                "headline": headline,
                "summary": summary,
                "url": url,
                "source": source,
                "from_cache": False,
            }
        )

    return results


def _empty_row(event_date: str, message: str) -> dict[str, Any]:
    return {
        "event_date": event_date,
        "headline": None,
        "summary": message,
        "url": None,
        "source": None,
        "from_cache": False,
    }
