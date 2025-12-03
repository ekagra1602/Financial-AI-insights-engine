from sqlalchemy import Column, Integer, String, Float, ForeignKey
from sqlalchemy.orm import relationship
from database import Base
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

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    email = Column(String, unique=True, index=True)
    hashed_password = Column(String)

    watchlist_items = relationship("Watchlist", back_populates="owner")

class Watchlist(Base):
    __tablename__ = "watchlist"

    id = Column(Integer, primary_key=True, index=True)
    ticker = Column(String, index=True)
    user_id = Column(Integer, ForeignKey("users.id"))

    owner = relationship("User", back_populates="watchlist_items")
