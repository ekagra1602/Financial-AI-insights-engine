"""
News Briefing Router — Dedicated endpoint for news briefing generation.

Completely decoupled from the notification polling endpoint to avoid
blocking and SQLite locking issues.

Endpoints:
  POST /news-briefing/generate      — Generate news briefings for all enabled watchlist stocks
  POST /news-briefing/toggle/{symbol} — Enable/disable news briefing for a stock
"""

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from datetime import datetime
from database import (
    get_watchlist, update_news_notify_count,
    save_generated_notification, notification_exists,
    news_article_already_sent, save_news_article_sent,
)
from services.ai100_client import summarize_only
import pytz
import json
import hashlib

router = APIRouter(prefix="/news-briefing", tags=["News Briefing"])

ET = pytz.timezone("America/New_York")

# Lazy-init NewsProcessor to avoid import-time failures
_news_processor = None

def _get_news_processor():
    global _news_processor
    if _news_processor is None:
        from services.news_processor import NewsProcessor
        _news_processor = NewsProcessor()
    return _news_processor


def _generate_briefing_for_symbol(symbol: str) -> dict | None:
    """
    Generate a single news briefing notification for a symbol.
    Returns the notification dict if created, or None if already exists / no articles.
    This is the slow function — it fetches from Finnhub, scrapes, and summarizes.
    """
    now_et = datetime.now(ET)
    today_str = now_et.strftime("%Y-%m-%d")
    notif_id = f"{symbol}_NEWS_{today_str}_10AM"

    # Already generated today?
    if notification_exists(notif_id):
        return None

    processor = _get_news_processor()

    # Fetch fresh news
    from_date = today_str
    to_date = today_str
    try:
        raw_articles = processor.fetch_and_process_news(
            ticker=symbol, from_date=from_date, to_date=to_date, force_refresh=True
        )
    except Exception as e:
        print(f"  [News Briefing] Error fetching news for {symbol}: {e}")
        return None

    if not raw_articles:
        return None

    # Filter and summarize articles
    articles_for_notif = []
    for article in raw_articles[:5]:
        url = article.get("url", "")
        if not url:
            continue
        url_hash = hashlib.sha256(url.lower().strip().encode()).hexdigest()

        if news_article_already_sent(symbol, url_hash):
            continue

        summary = article.get("summary", "")
        if not summary or len(summary) < 10:
            content = article.get("headline", url)
            try:
                summary = summarize_only(content)
            except Exception:
                summary = content[:200]

        articles_for_notif.append({
            "headline": article.get("headline", "News Article"),
            "summary": summary[:300],
            "url": url,
            "source": article.get("source", "Unknown"),
        })

        try:
            save_news_article_sent(symbol, url_hash, url, today_str)
        except Exception as e:
            print(f"  [News Briefing] Error saving article sent: {e}")

    if not articles_for_notif:
        return None

    # Build preview message
    preview_parts = []
    for a in articles_for_notif[:3]:
        preview_parts.append(f"• {a['headline'][:80]}")
    preview = "\n".join(preview_parts)
    if len(articles_for_notif) > 3:
        preview += f"\n  +{len(articles_for_notif) - 3} more"

    articles_json = json.dumps(articles_for_notif)

    n = {
        "id": notif_id,
        "type": "NEWS_BRIEFING",
        "symbol": symbol,
        "date": today_str,
        "title": f"{symbol} Morning News Briefing",
        "message": preview,
        "direction": "neutral",
        "percentChange": 0,
        "articles": articles_json,
    }
    save_generated_notification(n)
    return n


@router.post("/generate")
def generate_news_briefings():
    """
    Generate news briefings for all watchlist stocks with news enabled.
    Called by the frontend timer at 10 AM ET, or after a toggle-on.
    This endpoint is intentionally slow — it may take 30+ seconds.
    """
    watchlist = get_watchlist()
    generated = []
    errors = []

    for item in watchlist:
        symbol = item["symbol"]
        count = item.get("news_notify_count", 0) or 0
        if count <= 0:
            continue

        try:
            result = _generate_briefing_for_symbol(symbol)
            if result:
                generated.append(symbol)
        except Exception as e:
            print(f"  [News Briefing] Error generating for {symbol}: {e}")
            errors.append({"symbol": symbol, "error": str(e)})

    return {
        "generated": generated,
        "errors": errors,
        "message": f"Generated briefings for {len(generated)} stock(s)",
    }


class ToggleRequest(BaseModel):
    enabled: bool


@router.post("/toggle/{symbol}")
def toggle_news_briefing(symbol: str, body: ToggleRequest):
    """
    Enable or disable morning news briefing for a stock.
    When enabling, also triggers immediate generation if not yet briefed today.
    """
    count = 1 if body.enabled else 0
    update_news_notify_count(symbol, count)

    result = {"symbol": symbol, "enabled": body.enabled, "generated": False}

    if body.enabled:
        # Try to generate immediately for this symbol
        try:
            n = _generate_briefing_for_symbol(symbol)
            if n:
                result["generated"] = True
        except Exception as e:
            print(f"  [News Briefing] Error on toggle-generate for {symbol}: {e}")
            result["error"] = str(e)

    return result
