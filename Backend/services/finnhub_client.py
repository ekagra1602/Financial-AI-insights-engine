import os
import requests
from fastapi import APIRouter, HTTPException, Query
from dotenv import load_dotenv
from models import KeyStatistics

load_dotenv()

router = APIRouter()
FINNHUB_API_KEY = os.getenv("FINNHUB_API_KEY")
FINNHUB_BASE_URL = "https://finnhub.io/api/v1"

if not FINNHUB_API_KEY:
    print("Warning: FINNHUB_API_KEY not found in environment variables.")

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
    
    try:
        # Fetch data from Finnhub
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
        
        return stats
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
