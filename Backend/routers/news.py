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
    to_date: Optional[str] = None
):
    """
    Get summarized news for a specific company ticker.
    Defaults to the last 7 days if dates are not provided.
    """
    # Default to last 7 days if not provided
    if not to_date:
        to_date = datetime.date.today().isoformat()
    if not from_date:
        from_date = (datetime.date.today() - datetime.timedelta(days=7)).isoformat()
        
    try:
        news = news_processor.fetch_and_process_news(ticker, from_date, to_date)
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/news")
async def get_market_news_summary():
    """
    Get summarized general market news (trending).
    """
    try:
        # Pass None as ticker to fetch general news
        news = news_processor.fetch_and_process_news(ticker=None)
        return news
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
