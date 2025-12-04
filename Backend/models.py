from pydantic import BaseModel
from typing import Optional

class KeyStatistics(BaseModel):
    market_cap: Optional[float] = None
    pe_ratio: Optional[float] = None
    dividend_yield: Optional[float] = None
    average_volume: Optional[float] = None
    high_today: Optional[float] = None
    low_today: Optional[float] = None
    open_price: Optional[float] = None
    current_price: Optional[float] = None
    prev_close_price: Optional[float] = None
    volume: Optional[float] = None
    fifty_two_week_high: Optional[float] = None
    fifty_two_week_low: Optional[float] = None
    name: Optional[str] = None
    description: Optional[str] = None
    country: Optional[str] = None
    currency: Optional[str] = None
    exchange: Optional[str] = None
    ipo: Optional[str] = None
    marketCapitalization: Optional[float] = None
    shareOutstanding: Optional[float] = None
    ticker: Optional[str] = None
    weburl: Optional[str] = None
    logo: Optional[str] = None
    finnhubIndustry: Optional[str] = None
