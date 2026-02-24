from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.finnhub_client import router as finnhub_router

app = FastAPI(title="Qualcomm Financial Insights Engine API")


@app.on_event("startup")
def on_startup():
    try:
        from database import init_db
        init_db()
    except Exception as e:
        print(f"Warning: Database init skipped ({e}). Install deps with: pip install -r requirements.txt")


@app.on_event("startup")
async def start_price_monitor():
    import asyncio
    from services.price_monitor import monitor_loop
    asyncio.create_task(monitor_loop())

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For MVP, allow all. In prod, restrict to frontend URL.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.reminders import router as reminders_router

# Include routers
app.include_router(finnhub_router, prefix="/api/v1")
app.include_router(reminders_router, prefix="/api/v1")

try:
    from routers.news import router as news_router
    app.include_router(news_router, prefix="/api/v1")
except Exception as e:
    print(f"Warning: news router not loaded ({e}). Install sentence-transformers etc. for news.")

try:
    from routers.stock_data import router as stock_router
    app.include_router(stock_router, prefix="/api/v1")
except Exception as e:
    print(f"Warning: stock_data router not loaded ({e})")

try:
    from routers.watchlist import router as watchlist_router
    app.include_router(watchlist_router, prefix="/api/v1")
except Exception as e:
    print(f"Warning: watchlist router not loaded ({e})")


@app.get("/")
async def root():
    return {"message": "Financial Insights Engine API is running"}
