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

@router.get("/news/similar/{url_hash}")
async def get_similar_news(
    url_hash: str,
    limit: int = 5
):
    """
    Finds news articles similar to the given article hash using vector similarity.
    """
    try:
        # 1. Get the source article to retrieve its embedding
        article = news_processor.supabase.get_article_by_hash(url_hash)
        if not article:
            raise HTTPException(status_code=404, detail="Article not found")
        
        embedding = article.get("embedding")
        
        # If embedding is missing (old article), generate it on the fly
        if not embedding or isinstance(embedding, str): 
            # Check if it's a string (sometimes JSON decoding issue) or missing
            # Ideally it's a list.
            from services.embeddings import get_embedding
            summary = article.get('summary', '')
            headline = article.get('headline', '')
            text_to_embed = f"{headline} {summary}"
            embedding = get_embedding(text_to_embed)
            
            # Save it back to DB for future use
            news_processor.supabase.save_embedding(url_hash, embedding)
            
        # 2. Search for similar articles
        # 2. Search for similar articles
        # Lower threshold to 0.2 to ensure better recall on smaller datasets
        # The RPC function sorts by similarity desc, so we still get best matches first
        similar_articles = news_processor.supabase.search_similar_articles(
            query_embedding=embedding, 
            match_threshold=0.2, 
            match_count=limit + 1
        )
        
        if not similar_articles:
            return []
            
        # Filter out the source article itself
        filtered = [a for a in similar_articles if a.get('url_hash') != url_hash]
        
        return filtered[:limit]
        
    except Exception as e:
        print(f"Error finding similar news: {e}")
        raise HTTPException(status_code=500, detail=str(e))
