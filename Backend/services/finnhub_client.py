import os
import requests
from fastapi import APIRouter, HTTPException, Query
from dotenv import load_dotenv
from models import KeyStatistics
from datetime import datetime
import pytz

load_dotenv()

router = APIRouter()
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
FINNHUB_BASE_URL = "https://finnhub.io/api/v1"

if not FINNHUB_API_KEY:
    print("Warning: FINNHUB_API_KEY not found in environment variables.")

ET = pytz.timezone("America/New_York")

# In-memory cache for /quote results: { symbol: { "data": KeyStatistics, "timestamp": datetime } }
_stats_cache: dict = {}
CACHE_TTL_SECONDS = 120  # 2 minutes

def _is_market_open() -> bool:
    now_et = datetime.now(ET)
    if now_et.weekday() >= 5:
        return False
    market_open = now_et.replace(hour=9, minute=30, second=0, microsecond=0)
    market_close = now_et.replace(hour=16, minute=0, second=0, microsecond=0)
    return market_open <= now_et <= market_close

def get_finnhub_quote(symbol: str):
    url = f"{FINNHUB_BASE_URL}/quote"
    params = {"symbol": symbol, "token": FINNHUB_API_KEY}
    response = requests.get(url, params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch quote data")
    return response.json()

def get_finnhub_metric(symbol: str):
    url = f"{FINNHUB_BASE_URL}/stock/metric"
    params = {"symbol": symbol, "metric": "all", "token": FINNHUB_API_KEY}
    response = requests.get(url, params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch metric data")
    return response.json()

def get_finnhub_profile(symbol: str):
    url = f"{FINNHUB_BASE_URL}/stock/profile2"
    params = {"symbol": symbol, "token": FINNHUB_API_KEY}
    response = requests.get(url, params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch profile data")
    return response.json()

def get_finnhub_search(query: str):
    url = f"{FINNHUB_BASE_URL}/search"
    params = {"q": query, "token": FINNHUB_API_KEY}
    response = requests.get(url, params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to search stocks")
    return response.json()

def get_company_news(symbol: str, from_date: str, to_date: str):
    url = f"{FINNHUB_BASE_URL}/company-news"
    params = {
        "symbol": symbol,
        "from": from_date,
        "to": to_date,
        "token": FINNHUB_API_KEY
    }
    response = requests.get(url, params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch company news")
    return response.json()

def get_market_news(category: str = "general"):
    url = f"{FINNHUB_BASE_URL}/news"
    params = {
        "category": category,
        "token": FINNHUB_API_KEY
    }
    response = requests.get(url, params=params)
    if response.status_code != 200:
        raise HTTPException(status_code=response.status_code, detail="Failed to fetch market news")
    return response.json()

@router.get("/search")
async def search_stocks(q: str = Query(..., description="Search query")):
    if not FINNHUB_API_KEY:
        raise HTTPException(status_code=500, detail="API Key not configured")
    try:
        return get_finnhub_search(q)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/quote", response_model=KeyStatistics)
async def get_key_statistics(symbol: str = Query(..., description="Stock symbol")):
    if not FINNHUB_API_KEY:
        raise HTTPException(status_code=500, detail="API Key not configured")
    
    symbol = symbol.upper()
    now = datetime.now()
    
    # Check cache
    cached = _stats_cache.get(symbol)
    if cached:
        age = (now - cached["timestamp"]).total_seconds()
        # If fresh (< 2 min) OR market is closed → return cached
        if age < CACHE_TTL_SECONDS or not _is_market_open():
            print(f"  Stats cache HIT for {symbol} ({int(age)}s old, market_open={_is_market_open()})")
            return cached["data"]
    
    try:
        print(f"  Stats cache MISS for {symbol} — fetching from Finnhub...")
        quote_data = get_finnhub_quote(symbol)
        metric_data = get_finnhub_metric(symbol)
        profile_data = get_finnhub_profile(symbol)
        
        metrics = metric_data.get("metric", {})
        
        stats = KeyStatistics(
            market_cap=metrics.get("marketCapitalization"),
            pe_ratio=metrics.get("peTTM"),
            dividend_yield=metrics.get("dividendYieldIndicatedAnnual"),
            average_volume=metrics.get("10DayAverageTradingVolume"),
            high_today=quote_data.get("h"),
            low_today=quote_data.get("l"),
            open_price=quote_data.get("o"),
            current_price=quote_data.get("c"),
            prev_close_price=quote_data.get("pc"),
            volume=None,
            fifty_two_week_high=metrics.get("52WeekHigh"),
            fifty_two_week_low=metrics.get("52WeekLow"),
            name=profile_data.get("name"),
            description=None, 
            country=profile_data.get("country"),
            currency=profile_data.get("currency"),
            exchange=profile_data.get("exchange"),
            ipo=profile_data.get("ipo"),
            marketCapitalization=profile_data.get("marketCapitalization"),
            shareOutstanding=profile_data.get("shareOutstanding"),
            ticker=profile_data.get("ticker"),
            weburl=profile_data.get("weburl"),
            logo=profile_data.get("logo"),
            finnhubIndustry=profile_data.get("finnhubIndustry")
        )
        
        # Store in cache
        _stats_cache[symbol] = {"data": stats, "timestamp": now}
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

