from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from database import add_to_watchlist, remove_from_watchlist, get_watchlist
from services.finnhub_client import get_finnhub_quote

router = APIRouter()

class WatchlistItem(BaseModel):
    symbol: str
    name: str

@router.get("/watchlist", tags=["Watchlist"])
def read_watchlist():
    items = get_watchlist()
    # Enrich with current price
    result = []
    for item in items:
        try:
            quote = get_finnhub_quote(item["symbol"])
            current_price = quote.get('c')
            percent_change = quote.get('dp')
        except:
            current_price = None
            percent_change = None
            
        result.append({
            **item,
            "price": current_price,
            "change": percent_change,
            "news_notify_count": item.get("news_notify_count", 0) or 0,
        })
    return result

@router.post("/watchlist", tags=["Watchlist"])
def add_item(item: WatchlistItem):
    add_to_watchlist(item.symbol, item.name)
    return {"message": "Added to watchlist"}

@router.delete("/watchlist/{symbol}", tags=["Watchlist"])
def delete_item(symbol: str):
    remove_from_watchlist(symbol)
    return {"message": "Removed from watchlist"}


