from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.finnhub_client import router as finnhub_router

app = FastAPI(title="Qualcomm Financial Insights Engine API")

from database import init_db

@app.on_event("startup")
def on_startup():
    init_db()

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For MVP, allow all. In prod, restrict to frontend URL.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.news import router as news_router

# Include routers
app.include_router(finnhub_router, prefix="/api/v1")
app.include_router(news_router, prefix="/api/v1")
from routers.stock_data import router as stock_router
app.include_router(stock_router, prefix="/api/v1")
from routers.watchlist import router as watchlist_router
app.include_router(watchlist_router, prefix="/api/v1")
from routers.tickers import router as tickers_router
app.include_router(tickers_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Financial Insights Engine API is running"}
