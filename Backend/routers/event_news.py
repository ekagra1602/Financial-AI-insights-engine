from typing import Optional

from fastapi import APIRouter, HTTPException, Query

from services.event_news_service import get_or_fetch_event_news
from services.supabase_client import SupabaseClient

router = APIRouter()
_supabase = SupabaseClient()


@router.get("/stocks/{ticker}/event-news", tags=["Stock Data"])
async def get_event_news_for_chart(
    ticker: str,
    dates: Optional[list[str]] = Query(None, description="Calendar dates YYYY-MM-DD (repeat query param)"),
    force_refresh: bool = False,
):
    """
    Lazy pipeline: check `stock_event_news` per date, then Finnhub only for cache misses.
    Separate from `/news/{ticker}` summarization cache.
    """
    t = (ticker or "").strip().upper()
    if not t:
        raise HTTPException(status_code=400, detail="Invalid ticker")
    cleaned = [d[:10] for d in (dates or []) if d and len(d) >= 10]
    if not cleaned:
        return []

    try:
        return get_or_fetch_event_news(_supabase, t, cleaned, force_refresh=force_refresh)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
