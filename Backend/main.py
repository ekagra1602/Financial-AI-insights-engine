from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from services.finnhub_client import router as finnhub_router

app = FastAPI(title="Qualcomm Financial Insights Engine API")

# Configure CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # For MVP, allow all. In prod, restrict to frontend URL.
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(finnhub_router, prefix="/api/v1")

@app.get("/")
async def root():
    return {"message": "Financial Insights Engine API is running"}
