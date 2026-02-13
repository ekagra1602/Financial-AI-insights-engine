from fastapi import APIRouter, Query, HTTPException
from services.news_processor import NewsProcessor
from typing import List, Optional
import datetime

router = APIRouter()
news_processor = NewsProcessor()

@router.get("/news/{ticker}")
async def get_company_news_summary(
    ticker: str,
    from_date: Optional[str] = None,
    to_date: Optional[str] = None,
    force_refresh: bool = False
):
    """
    Get summarized news for a specific company ticker.
    Defaults to the last 1 day if dates are not provided.
    Pass force_refresh=true to bypass cache and fetch fresh news.
    """
    # Default to last 1 day if not provided
    if not to_date:
        to_date = datetime.date.today().isoformat()
    if not from_date:
        from_date = (datetime.date.today() - datetime.timedelta(days=1)).isoformat()
        
    try:
        news = news_processor.fetch_and_process_news(ticker, from_date, to_date, force_refresh=force_refresh)
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/news")
async def get_market_news_summary(
    force_refresh: bool = False
):
    """
    Get summarized general market news (trending).
    Pass force_refresh=true to bypass cache and fetch fresh news.
    """
    try:
        news = news_processor.fetch_and_process_news(ticker=None, force_refresh=force_refresh)
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
